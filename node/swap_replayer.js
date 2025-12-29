import { config as dotenvConfig } from "dotenv";
import { ethers } from "ethers";
import mysql from "mysql2/promise";
import { readFile } from "fs/promises";
import { initializeDatabaseStructure } from "./initDB.js";
import { appendFile } from "fs/promises";
import { SocksProxyAgent } from 'socks-proxy-agent';
import { Connection, Keypair, VersionedTransaction, PublicKey } from '@solana/web3.js';
import bs58 from 'bs58';
import axios from 'axios';
import path from 'path';
import fs from 'fs';

dotenvConfig({ path: '.env' });

// MySQL 连接池配置
const dbConfig = {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
};

let cfgdb;

// 代理配置
const ENABLE_PROXY = process.env.ENABLE_PROXY === 'true';
const PROXY_URL = process.env.PROXY_URL || 'socks5h://127.0.0.1:1086';

let client;
if (ENABLE_PROXY) {
    const proxyAgent = new SocksProxyAgent(PROXY_URL);
    client = axios.create({
        baseURL: 'https://api.jup.ag/ultra',
        proxy: false,
        httpAgent: proxyAgent,
        httpsAgent: proxyAgent,
        timeout: 10_000,
        headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.JUP_API_KEY }
    });
    console.log('🔗 已启用代理:', PROXY_URL);
} else {
    client = axios.create({
        baseURL: 'https://api.jup.ag/ultra',
        timeout: 10_000,
        headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.JUP_API_KEY }
    });
    console.log('🌐 未启用代理，使用直接连接');
}
// 加载代币数据
const tokensPath = path.join(process.cwd(), 'tokens.json');
let tokensData = [];
try {
    const tokensRaw = fs.readFileSync(tokensPath, 'utf8');
    tokensData = JSON.parse(tokensRaw);
} catch (err) {
    console.error('Error reading tokens.json:', err);
}

// 创建pinaAddress到代币信息的映射
const pinaAddressToToken = {};
tokensData.forEach(token => {
    if (token.pinaAddress) {
        pinaAddressToToken[token.pinaAddress] = {
            address: token.address,
            decimals: token.decimals,
            shortName: token.shortName
        };
    }
});
async function writeSwapLog(message) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}\n`;
    try {
        await appendFile("swap.log", logMessage);
    } catch (error) {
        console.error("❌ 写入日志文件失败:", error.message);
    }
}
async function main() {
    try {
        console.log("📡 正在连接 MySQL 数据库...");
        // 使用连接池，支持并发操作
        cfgdb = mysql.createPool(dbConfig);
        console.log("✅ MySQL 数据库连接池创建成功");
        
        await initializeDatabaseStructure(cfgdb);
        console.log("🎉 数据库初始化成功，继续执行其他逻辑...");
    } catch (err) {
        console.error("❌ 数据库连接或初始化失败，程序终止:", err.message);
        process.exit(1);
    }

    const provider = new ethers.providers.JsonRpcProvider(process.env.PIN_RPC);
    const signerWallet = new ethers.Wallet(process.env.SIGN_PK);
    const relayerWallet = new ethers.Wallet(process.env.RELAYER_PK);
    const signer = relayerWallet.connect(provider);
    const iface = new ethers.utils.Interface(
        await readFile(new URL("./abis/Swap.json", import.meta.url), "utf-8")
    );
    const bridge = new ethers.Contract(process.env.SWAP_ADDR, iface.format(), signer);
    const swapFilter = bridge.filters.RequestCreated();

    let swapIsFetching = false;
    async function getMaxBlockNumber() {
        const query = `SELECT max(blockNumber) AS maxBlock FROM pinswap_logs`;
        try {
            const row = await getAsync(query);
            return row?.maxBlock ?? 747521;
        } catch (err) {
            console.error(`❌ 查询 pinswap_logs 最新区块失败:`, err.message);
            throw err;
        }
    }
    async function getSwapLogs() {
        if (swapIsFetching) return;
        swapIsFetching = true;
        const lastBlock = await getMaxBlockNumber();
        console.log(`🚀 从区块 ${lastBlock + 1} 开始获取日志`);
        try {
            await fetchSwapLogsByRange(lastBlock + 1);
        } catch (err) {
            console.error("❌ fetchSwapLogsByRange 执行异常:", err.message);
        } finally {
            swapIsFetching = false;
        }
    }
    async function fetchSwapLogsByRange(from) {
        const current = await provider.getBlockNumber();
        if (current < from) return;

        try {
            const logs = await provider.getLogs({
                ...swapFilter,
                fromBlock: from,
                toBlock: current,
            });
            if (!logs.length) return;
            console.log(`📦 获取到 ${logs.length} 条日志`);

            const insert = `
                    INSERT IGNORE INTO pinswap_logs (
                      address, topic0, topic1, data,
                      blockNumber, transactionHash, transactionIndex, logIndex, time,
                      swapId, fromAddress, fromToken, toToken, amount, feeAmount
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

            for (const log of logs) {
                const parsed = bridge.interface.parseLog(log);
                const { requestId: swapid, user, fromToken, toToken, amount, feeAmount } = parsed.args;
                const block = await provider.getBlock(log.blockNumber);
                const timestamp = block.timestamp;
                const sql = [
                    log.address,
                    log.topics[0] || null,
                    log.topics[1] || null,
                    log.data || null,
                    log.blockNumber,
                    log.transactionHash,
                    log.transactionIndex,
                    log.logIndex,
                    timestamp,
                    swapid.toString(),
                    user,
                    fromToken,
                    toToken,
                    ethers.utils.formatUnits(amount, 18),
                    ethers.utils.formatUnits(feeAmount, 18),
                ];
                const { lastID } = await runAsync(insert, sql);
                // 根据swapId获取swap合约的最新数据
                try {
                    const swapData = await bridge.requests(swapid);
                    console.log(`📋 Swap合约数据 - swapId: ${swapid}, user: ${swapData.user}, executed: ${swapData.executed}, amount: ${ethers.utils.formatUnits(swapData.amount, 18)}`);

                    if (swapData.executed) {
                        console.log(`⏭️  跳过已执行的swap请求 swapId: ${swapid}`);
                        continue;
                    }

                    if (swapData.user.toLowerCase() !== user.toLowerCase()) {
                        console.log(`❌ 用户地址不匹配 swapId: ${swapid}`);
                        continue;
                    }
                } catch (contractError) {
                    console.error(`❌ 获取swap合约数据失败 swapId: ${swapid}`);
                    continue;
                }
                try {
                    console.log('swap:', fromToken, toToken, amount.toString(), log.transactionHash)
                    const swapResult = await executeSwap(fromToken, toToken, amount.toString());
                    if (!swapResult.success) {
                        throw new Error(`Failed to calculate swap amount: ${swapResult.error}`);
                    }
                    const mintAmount = ethers.utils.parseUnits(swapResult.actualReceivedAmount.toString(), 18).toString();
                    const payload = ethers.utils.solidityKeccak256(
                        ['address', 'address', 'address', 'uint256', 'uint256', 'uint256'],
                        [user, fromToken, toToken, amount, mintAmount, swapid]
                    );
                    const signature = await signerWallet.signMessage(ethers.utils.arrayify(payload));
                    const tx = await bridge.executeSwap(swapid, mintAmount, signature);
                    await tx.wait();
                    await writeSwapLog(`SUCCESS: executeSwap - swapId=${swapid}, txHash=${tx.hash}, user=${user}, fromToken=${fromToken}, toToken=${toToken}, amount=${ethers.utils.formatUnits(amount, 18)}`);
                    const update = `UPDATE pinswap_logs SET executed = 1,executeTime = ?,executeTxHash = ?,mintAmount = ? WHERE transactionHash = ?`;
                    await runAsync(update, [Math.floor(Date.now() / 1000), tx.hash, ethers.utils.formatUnits(mintAmount, 18), log.transactionHash]);
                    console.log(`✅ executeSwap txHash=${tx.hash}`);
                } catch (executeError) {
                    console.error(`❌ executeSwap 失败 swapId=${swapid}, 错误:`, executeError.message);
                    await writeSwapLog(`FAILED: executeSwap - swapId=${swapid}, user=${user}, error=${executeError.message}`);
                    try {
                        const refundTx = await bridge.refundSwapRequest(swapid);
                        await refundTx.wait();
                        await writeSwapLog(`SUCCESS: refundSwapRequest - swapId=${swapid}, txHash=${refundTx.hash}, user=${user}`);
                        const refundUpdate = `UPDATE pinswap_logs SET refunded = 1, refundTime = ?, refundTxHash = ? WHERE transactionHash = ?`;
                        await runAsync(refundUpdate, [Math.floor(Date.now() / 1000), refundTx.hash, log.transactionHash]);
                        console.log(`✅ refundSwapRequest 成功 txHash=${refundTx.hash}`);
                    } catch (refundError) {
                        await writeSwapLog(`FAILED: refundSwapRequest - swapId=${swapid}, user=${user}, error=${refundError.message}`);
                        console.error(`❌ refundSwapRequest 也失败了 swapId=${swapid}, 错误:`, refundError.message);
                    }
                }
            }
        } catch (err) {
            console.error("轮询 initiateSwap 出错：", err);
        }
    }
    getSwapLogs();
    setInterval(getSwapLogs, 30 * 1000);
}
// 全局异常处理
process.on("uncaughtException", (err) => {
    console.error("🚨 未捕获异常:", err.message);
    process.exit(1);
});

process.on("unhandledRejection", (reason) => {
    console.error("⚠️ 未处理的Promise拒绝:", reason);
});

main().catch(async (err) => {
    console.error("❌ 主程序异常退出:", err.message);
    if (cfgdb) {
        await cfgdb.end();
    }
    process.exit(1);
});

// 优雅关闭数据库连接池
process.on('SIGINT', async () => {
    console.log('\n🛑 收到退出信号，正在关闭数据库连接池...');
    if (cfgdb) {
        await cfgdb.end();
    }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 收到终止信号，正在关闭数据库连接池...');
    if (cfgdb) {
        await cfgdb.end();
    }
    process.exit(0);
});
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
async function getTokenBalance(connection, wallet, mintAddress) {
    try {
        const tokenAccounts = await connection.getTokenAccountsByOwner(wallet.publicKey, {
            mint: new PublicKey(mintAddress)
        });
        if (tokenAccounts.value.length > 0) {
            const tokenBalance = await connection.getTokenAccountBalance(tokenAccounts.value[0].pubkey);
            return tokenBalance.value;
        }
        return null;
    } catch (error) {
        return null;
    }
}
async function executeSwap(inputMint, outputMint, amount) {
    try {
        const inputTokenInfo = pinaAddressToToken[inputMint];
        const outputTokenInfo = pinaAddressToToken[outputMint];
        if (!inputTokenInfo) {
            throw new Error(`Input token ${inputMint} not supported`);
        }
        if (!outputTokenInfo) {
            throw new Error(`Output token ${outputMint} not supported`);
        }
        const solanaInputMint = inputTokenInfo.address;
        const solanaOutputMint = outputTokenInfo.address;
        const inputDecimals = inputTokenInfo.decimals;
        const outputDecimals = outputTokenInfo.decimals;
        const amountInEther = ethers.utils.formatUnits(amount, 18);
        const roundedAmount = parseFloat(amountInEther).toFixed(inputDecimals);
        const finalAmount = ethers.utils.parseUnits(roundedAmount, inputDecimals).toString();
        const secretKey = bs58.decode(process.env.SOLANA_PRIVATE_KEY_BASE58);
        const wallet = Keypair.fromSecretKey(secretKey);
        // const connection = new Connection('https://rpc.ankr.com/solana/' + process.env.ANKR_SOLANA);
        // const inputTokenBalance = await getTokenBalance(connection, wallet, solanaInputMint);
        // const neededAmount = ethers.BigNumber.from(finalAmount);
        // const availableAmount = inputTokenBalance ? ethers.BigNumber.from(inputTokenBalance.amount) : ethers.BigNumber.from(0);
        // if (!inputTokenBalance || availableAmount.lt(neededAmount)) {
        //     throw new Error(`Insufficient balance. Need ${solanaInputMint} ${finalAmount}, but only have ${inputTokenBalance?.amount || 0}`);
        // }
        const { data: orderResponse } = await client.get('/v1/order', {
            params: {
                inputMint: solanaInputMint,
                outputMint: solanaOutputMint,
                amount: finalAmount,
                taker: process.env.SOLANA_PUBLIC_KEY_BASE58,
            }
        });
        if (!orderResponse || !orderResponse.outAmount || !orderResponse.requestId || orderResponse.errorCode) {
            throw new Error('Invalid order response');
        }
        if(orderResponse.slippageBps > 500){
            throw new Error(' slippageBps > 500');
        }
        const transactionBase64 = orderResponse.transaction
        const transaction = VersionedTransaction.deserialize(Buffer.from(transactionBase64, 'base64'))
        transaction.sign([wallet]);
        const signedTransaction = Buffer.from(transaction.serialize()).toString('base64');
        const { data: executeResponse } = await client.post('/v1/execute', {
            signedTransaction: signedTransaction,
            requestId: orderResponse.requestId,
        });
        // 检查execute接口是否返回错误状态
        if (executeResponse.status === "Failed") {
            const errorMsg = `Execute failed: ${executeResponse.error || 'Unknown error'}${executeResponse.code ? ` (code: ${executeResponse.code})` : ''}`;
            await writeSwapLog(`FAILED: executeSwap API - error=${errorMsg}, slot=${executeResponse.slot || 'unknown'}`);
            throw new Error(errorMsg);
        }
        if (!executeResponse || !executeResponse.outputAmountResult) {
            throw new Error('Invalid execute response');
        }
        const actualReceivedAmount = ethers.utils.formatUnits(executeResponse.outputAmountResult,outputDecimals);
        return { success: true, actualReceivedAmount };
    } catch (error) {
        return { success: false, error: error.message };
    }
}
/** 
 * 数据库写操作（INSERT/UPDATE/DELETE/DDL）
 * MySQL 连接池会自动处理并发，无需手动串行化
 */
async function runAsync(sql, params = []) {
    try {
        const [result] = await cfgdb.execute(sql, params);
        return { 
            lastID: result.insertId, 
            changes: result.affectedRows 
        };
    } catch (err) {
        throw err;
    }
}

/**
 * 数据库读操作
 * MySQL 连接池会自动处理并发，无需手动串行化
 */
async function getAsync(sql, params = []) {
    try {
        const [rows] = await cfgdb.execute(sql, params);
        return rows.length > 0 ? rows[0] : null;
    } catch (err) {
        throw err;
    }
}