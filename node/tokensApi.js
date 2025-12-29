import express from 'express';
import cors from 'cors';
import compression from 'compression';
import http from 'http';
import { InfluxDB, Point } from '@influxdata/influxdb-client';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { SocksProxyAgent } from 'socks-proxy-agent';
import { config as dotenvConfig } from "dotenv";
import cron from 'node-cron';
import { ethers } from "ethers";
import mysql from "mysql2/promise";
import { readFile } from "fs/promises";
import { initializeDatabaseStructure } from "./initDB.js";

// 环境配置
dotenvConfig({ path: '.env' });

// 常量配置
const CONFIG = {
    PORT: process.env.API_PORT || 3003,
    PRICE_CACHE_DURATION: 5 * 1000, // 5秒
    INFLUX_URL: process.env.INFLUX_URL,
    INFLUX_TOKEN: process.env.INFLUX_TOKEN,
    INFLUX_ORG: process.env.INFLUX_ORG,
    INFLUX_BUCKET: process.env.INFLUX_BUCKET,
    JUP_BASE_URL: 'https://api.jup.ag',
    ENABLE_PROXY: process.env.ENABLE_PROXY === 'true',
    PROXY_URL: process.env.PROXY_URL || 'socks5h://127.0.0.1:1086',
    TIMEOUT: 10_000
};

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

// 数据库初始化函数
async function initDatabase() {
    try {
        console.log("📡 正在连接 MySQL 数据库...");
        // 使用连接池，支持并发操作
        cfgdb = mysql.createPool(dbConfig);
        console.log("✅ MySQL 数据库连接池创建成功");
        
        await initializeDatabaseStructure(cfgdb);
        console.log("🎉 数据库初始化成功");
    } catch (err) {
        console.error("❌ 数据库连接或初始化失败，程序终止:", err.message);
        process.exit(1);
    }
}

const bscIface = new ethers.utils.Interface(
    await readFile(new URL("./abis/BscBridge.json", import.meta.url), "utf-8")
);
const swapIface = new ethers.utils.Interface(
    await readFile(new URL("./abis/Swap.json", import.meta.url), "utf-8")
);
const bscProvider = new ethers.providers.JsonRpcProvider(process.env.BSC_RPC);
const pinProvider = new ethers.providers.JsonRpcProvider(process.env.PIN_RPC);
const relayerWallet = new ethers.Wallet(process.env.RELAYER_PK);
const signerWallet = new ethers.Wallet(process.env.SIGN_PK);
const pinSigner = relayerWallet.connect(pinProvider);
const bscSigner = relayerWallet.connect(bscProvider);
const bscBridge = new ethers.Contract(process.env.BSC_BRIDGE_ADDR, bscIface.format(), bscSigner);
// 初始化HTTP客户端
let client;
if (CONFIG.ENABLE_PROXY) {
    const proxyAgent = new SocksProxyAgent(CONFIG.PROXY_URL);
    client = axios.create({
        baseURL: CONFIG.JUP_BASE_URL,
        proxy: false,
        httpAgent: proxyAgent,
        httpsAgent: proxyAgent,
        timeout: CONFIG.TIMEOUT,
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.JUP_API_KEY
        }
    });
    console.log('🔗 已启用代理:', CONFIG.PROXY_URL);
} else {
    client = axios.create({
        baseURL: CONFIG.JUP_BASE_URL,
        timeout: CONFIG.TIMEOUT,
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.JUP_API_KEY
        }
    });
    console.log('🌐 未启用代理，使用直接连接');
}

// 验证InfluxDB配置
if (!CONFIG.INFLUX_URL || !CONFIG.INFLUX_TOKEN || !CONFIG.INFLUX_ORG || !CONFIG.INFLUX_BUCKET) {
    console.error('❌ InfluxDB配置不完整，请在.pin_env文件中设置以下参数：');
    console.error('   INFLUX_URL - InfluxDB服务器地址');
    console.error('   INFLUX_TOKEN - InfluxDB访问令牌');
    console.error('   INFLUX_ORG - InfluxDB组织名称');
    console.error('   INFLUX_BUCKET - InfluxDB存储桶名称');
    process.exit(1);
}

// 初始化InfluxDB
const influxDB = new InfluxDB({
    url: CONFIG.INFLUX_URL,
    token: CONFIG.INFLUX_TOKEN
});
const queryApi = influxDB.getQueryApi(CONFIG.INFLUX_ORG);
const writeApi = influxDB.getWriteApi(CONFIG.INFLUX_ORG, CONFIG.INFLUX_BUCKET, 'ms');

// 初始化Express应用
const app = express();
app.use(express.json()); // 解析 JSON 请求体
app.use(cors());
app.use(compression({ threshold: 1024 }));
const server = http.createServer(app);

// 加载代币数据
const tokensPath = path.join(process.cwd(), 'tokens.json');
let tokensData = [];
// 预加载 pinaAddress 集合和 USD 地址，用于快速验证
let pinaAddressSet = new Set();
let usdPinaAddress = null;

try {
    const tokensRaw = fs.readFileSync(tokensPath, 'utf8');
    tokensData = JSON.parse(tokensRaw);
    
    // 初始化 pinaAddress 集合
    tokensData.forEach(token => {
        if (token.pinaAddress) {
            const pinaAddr = token.pinaAddress.toLowerCase();
            pinaAddressSet.add(pinaAddr);
            
            // 获取 USD 的 pinaAddress
            if (token.name && token.name.toLowerCase() === 'usd') {
                usdPinaAddress = pinaAddr;
            }
        }
    });
    
    console.log(`✅ 已加载 ${tokensData.length} 个代币，${pinaAddressSet.size} 个 pinaAddress`);
    if (usdPinaAddress) {
        console.log(`✅ USD pinaAddress: ${usdPinaAddress}`);
    } else {
        console.warn('⚠️  未找到 USD 代币');
    }
} catch (err) {
    console.error('Error reading tokens.json:', err);
}



// 缓存管理
let cachedPrices = {};
let lastPriceUpdate = 0;

// 工具函数
const utils = {
    // 时间戳转换
    normalizeTimestamp: (timestamp) => {
        const ts = Number(timestamp);
        return ts > 1000000000000 ? Math.floor(ts / 1000) : ts;
    },

    // 获取时间窗口配置
    getTimeWindowConfig: (timespan, multiplier) => {
        const configs = {
            'minute': { window: `${multiplier}m`, cacheTimeframe: `${multiplier}m` },
            'hour': { window: `${multiplier}h`, cacheTimeframe: `${multiplier}h` },
            'day': { window: `${multiplier}d`, cacheTimeframe: `${multiplier}d` }
        };
        console.log(timespan,multiplier,configs[timespan],configs['minute'])
        return configs[timespan] || configs['minute'];
    },

    dbQuery: (query, params = []) => {
        return getAsync(query, params, true);   // all 查询走队列
    },

    dbGet: (query, params = []) => {
        return getAsync(query, params, false);  // get 查询走队列
    },


    // 错误响应
    errorResponse: (res, status, message) => {
        console.error(`API Error [${status}]:`, message);
        res.status(status).json({ error: message });
    },

    // 成功响应
    successResponse: (res, data) => {
        res.json(data);
    }
};

// 补充代币参数的函数
const enrichTokenData = (token) => {
    return {
        ...token,
        exchange: token.shortName,
        market: token.shortName,
        ticker: token.shortName,
        priceCurrency: "usd",
        type: "ADRC"
    };
};

// API路由处理
const apiHandlers = {
    // 获取代币符号列表
    getSymbols: (req, res) => {
        try {
            const search = String(req.query.search || '').toLowerCase();

            // 过滤掉USD代币
            const nonUsdTokens = tokensData.filter(token =>
                token.shortName && token.shortName.toLowerCase() !== 'usd'
            );

            if (!search) {
                const enrichedTokens = nonUsdTokens.map(enrichTokenData);
                return utils.successResponse(res, enrichedTokens);
            }

            const filteredTokens = nonUsdTokens.filter(token =>
                (token.name && token.name.toLowerCase().includes(search)) ||
                (token.shortName && token.shortName.toLowerCase().includes(search))
            );

            const enrichedFilteredTokens = filteredTokens.map(enrichTokenData);
            utils.successResponse(res, enrichedFilteredTokens);
        } catch (error) {
            utils.errorResponse(res, 500, error.message);
        }
    },
    getUserLastSwaps: async (req, res) => {
        try {
            // 参数验证
            const userAddress = String(req.query.address || '');
            const tokenName = String(req.query.token || '');

            if (!userAddress || !ethers.utils.isAddress(userAddress)) {
                return utils.errorResponse(res, 400, '无效的用户地址');
            }

            if (!tokenName) {
                return utils.errorResponse(res, 400, '代币名称是必需的');
            }

            // 查找代币信息
            const tokenInfo = tokensData.find(token =>
                token.shortName && token.shortName.toLowerCase() === tokenName.toLowerCase()
            );

            if (!tokenInfo || !tokenInfo.pinaAddress) {
                return utils.errorResponse(res, 404, '未找到代币或缺少pinaAddress');
            }

            const tokenAddress = tokenInfo.pinaAddress;

            // 优化：使用单个查询获取所有相关数据
            const comprehensiveQuery = `
                SELECT 
                    amount,
                    feeAmount,
                    mintAmount,
                    fromToken,
                    toToken,
                    time,
                    CASE 
                        WHEN toToken = ? THEN 'buy'
                        WHEN fromToken = ? THEN 'sell'
                    END as transaction_type
                FROM pinswap_logs 
                WHERE fromAddress = ? 
                AND (toToken = ? OR fromToken = ?) 
                AND executed = 1
                ORDER BY time DESC`;

            const allTransactions = await utils.dbQuery(comprehensiveQuery, [
                tokenAddress, tokenAddress, userAddress, tokenAddress, tokenAddress
            ]);

            if (!allTransactions || allTransactions.length === 0) {
                return utils.successResponse(res, {
                    buyPrice: null,
                    sellPrice: null,
                    buyQuantity: null,
                    sellQuantity: null,
                    averageCost: null,
                    realizedPnL: null
                });
            }

            // 分离买入和卖出交易
            const buyTransactions = allTransactions.filter(tx => tx.transaction_type === 'buy');
            const sellTransactions = allTransactions.filter(tx => tx.transaction_type === 'sell');

            // 计算买入统计
            const buyStats = apiHandlers._calculateBuyStats(buyTransactions);

            // 计算卖出统计
            const sellStats = apiHandlers._calculateSellStats(sellTransactions);

            // 计算平均成本
            const averageCost = buyStats.totalQuantity > 0 ? buyStats.totalAmount / buyStats.totalQuantity : null;

            // 计算已实现盈亏
            const realizedPnL = apiHandlers._calculateRealizedPnL(buyStats, sellStats, averageCost);

            // 获取最新交易信息
            const lastBuy = buyTransactions[0] || null;
            const lastSell = sellTransactions[0] || null;

            const result = {
                buyPrice: lastBuy ? apiHandlers._calculateBuyPrice(lastBuy) : null,
                sellPrice: lastSell ? apiHandlers._calculateSellPrice(lastSell) : null,
                buyQuantity: lastBuy ? parseFloat(lastBuy.mintAmount || '0') : null,
                sellQuantity: lastSell ? parseFloat(lastSell.amount || '0') : null,
                averageCost,
                realizedPnL
            };

            utils.successResponse(res, result);

        } catch (error) {
            console.error('getUserLastSwaps 错误:', error);
            utils.errorResponse(res, 500, `查询用户交易记录失败: ${error.message}`);
        }
    },

    // 辅助函数：计算买入统计
    _calculateBuyStats: (transactions) => {
        let totalAmount = 0;
        let totalQuantity = 0;

        for (const tx of transactions) {
            const amount = parseFloat(tx.amount || '0');
            const mintAmount = parseFloat(tx.mintAmount || '0');

            if (mintAmount > 0) {
                totalAmount += amount;
                totalQuantity += mintAmount;
            }
        }

        return {
            totalAmount,
            totalQuantity,
            averagePrice: totalQuantity > 0 ? totalAmount / totalQuantity : 0
        };
    },

    // 辅助函数：计算卖出统计
    _calculateSellStats: (transactions) => {
        let totalAmount = 0;
        let totalQuantity = 0;

        for (const tx of transactions) {
            const amount = parseFloat(tx.amount || '0');
            const mintAmount = parseFloat(tx.mintAmount || '0');

            if (amount > 0) {
                totalAmount += mintAmount; // 卖出获得的USD
                totalQuantity += amount;   // 卖出的代币数量
            }
        }

        return {
            totalAmount,
            totalQuantity,
            averagePrice: totalQuantity > 0 ? totalAmount / totalQuantity : 0
        };
    },

    // 辅助函数：计算已实现盈亏
    _calculateRealizedPnL: (buyStats, sellStats, averageCost) => {
        if (!averageCost || sellStats.totalQuantity === 0) {
            return 0;
        }

        try {
            const costOfSoldTokens = sellStats.totalQuantity * averageCost;
            const realizedPnL = sellStats.totalAmount - costOfSoldTokens;
            return parseFloat(realizedPnL.toFixed(6)); // 保留6位小数
        } catch (error) {
            console.error('计算已实现盈亏时出错:', error);
            return 0;
        }
    },

    // 辅助函数：计算买入价格
    _calculateBuyPrice: (transaction) => {
        try {
            const amount = parseFloat(transaction.amount || '0');
            const mintAmount = parseFloat(transaction.mintAmount || '0');

            if (mintAmount > 0) {
                return parseFloat((amount / mintAmount).toFixed(6));
            }
            return null;
        } catch (error) {
            console.error('计算买入价格时出错:', error);
            return null;
        }
    },

    // 辅助函数：计算卖出价格
    _calculateSellPrice: (transaction) => {
        try {
            const amount = parseFloat(transaction.amount || '0');
            const mintAmount = parseFloat(transaction.mintAmount || '0');

            if (amount > 0) {
                return parseFloat((mintAmount / amount).toFixed(6));
            }
            return null;
        } catch (error) {
            console.error('计算卖出价格时出错:', error);
            return null;
        }
    },
    // 获取K线数据
    getKline: async (req, res) => {
        try {
            const symbol = String(req.query.symbol || '');
            let fromTs = utils.normalizeTimestamp(req.query.from);
            let toTs = utils.normalizeTimestamp(req.query.to);
            const multiplier = Number(req.query.multiplier) || 1;
            const timespan = String(req.query.timespan || 'minute');

            if (!symbol || !fromTs || !toTs) {
                return utils.errorResponse(res, 400, 'Missing required parameters');
            }
            const { window, cacheTimeframe } = utils.getTimeWindowConfig(timespan, multiplier);

            // 查询缓存数据
            const cacheQuery = `
                SELECT time, open, high, low, close, volume 
                FROM kline_cache 
                WHERE symbol = ? AND timeframe = ? AND time >= ? AND time <= ?
                ORDER BY time ASC`;

            const cachedData = await utils.dbQuery(cacheQuery, [symbol, cacheTimeframe, fromTs, toTs]);

            let influxFromTs = fromTs;
            let combinedData = [];

            if (cachedData.length > 0) {
                combinedData = cachedData;
                const lastCachedTime = cachedData[cachedData.length - 1].time;
                if (lastCachedTime >= toTs) {
                    return utils.successResponse(res, combinedData);
                }
                influxFromTs = lastCachedTime + 1;
            }

            // 查询InfluxDB数据
            const flux = `from(bucket:"${CONFIG.INFLUX_BUCKET}")
                |> range(start: ${new Date(influxFromTs * 1000).toISOString()}, stop: ${new Date(toTs * 1000).toISOString()})
                |> filter(fn: (r) => r._measurement == "kline" and r.symbol == "${symbol}")
                |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
                |> window(every: ${window})
                |> reduce(
                    fn: (r, accumulator) => ({
                        open: if accumulator.count == 0 then r.price else accumulator.open,
                        high: if accumulator.count == 0 then r.price else if r.price > accumulator.high then r.price else accumulator.high,
                        low: if accumulator.count == 0 then r.price else if r.price < accumulator.low then r.price else accumulator.low,
                        close: r.price,
                        count: accumulator.count + 1,
                        time: if accumulator.count == 0 then time(v: r._time) else accumulator.time
                    }),
                    identity: {
                        open: 0.0, 
                        high: 0.0, 
                        low: 999999999.0, 
                        close: 0.0, 
                        count: 0,
                        time: time(v: "1970-01-01T00:00:00Z")
                    }
                )
                |> map(fn: (r) => ({
                    _time: r.time,
                    open: r.open,
                    high: if r.low == 999999999.0 then r.open else r.high,
                    low: if r.low == 999999999.0 then r.open else r.low,
                    close: r.close
                }))
                |> sort(columns:["_time"])`;

            const rows = await queryApi.collectRows(flux);
            const influxData = rows.map((r) => ({
                time: Math.floor(new Date(r._time).getTime() / 1000),
                open: r.open,
                high: r.high,
                low: r.low,
                close: r.close,
                volume: 0,
            }));

            const allData = [...combinedData, ...influxData];
            utils.successResponse(res, allData);
        } catch (error) {
            console.error('Kline data error:', error);
            utils.errorResponse(res, 500, error.message);
        }
    },

    // 获取当前时间
    getTime: (req, res) => {
        utils.successResponse(res, { epoch: Math.floor(Date.now() / 1000) });
    },

    // 获取价格数据
    getPrices: async (req, res) => {
        try {
            const name = String(req.query.name || '');
            if (!name) {
                return utils.successResponse(res, cachedPrices);
            }

            const tokenPrice = cachedPrices[name];
            if (tokenPrice) {
                return utils.successResponse(res, { [name]: tokenPrice });
            }

            utils.errorResponse(res, 404, 'Token not found');
        } catch (error) {
            utils.errorResponse(res, 500, error.message);
        }
    },

    // 获取报价
    getQuote: async (req, res) => {
        try {
            const from = String(req.query.from || '');
            const to = String(req.query.to || '');
            let amount = Number(req.query.amount || 1);

            if (!from || !to || !amount) {
                return utils.errorResponse(res, 400, 'from, to and amount are required');
            }

            const getJupToken = (name) => {
                return tokensData.find(token => token.pinaAddress.toLowerCase() === name.toLowerCase());
            };

            const fromToken = getJupToken(from);
            const toToken = getJupToken(to);

            if (!fromToken) {
                return utils.errorResponse(res, 404, `Token ${from} not found`);
            }
            if (!toToken) {
                return utils.errorResponse(res, 404, `Token ${to} not found`);
            }

            const inputMint = fromToken.address;
            const outputMint = toToken.address;
            const fromDecimals = fromToken.decimals;
            const toDecimals = toToken.decimals;
            const formattedAmount = parseFloat(parseFloat(amount.toString()).toFixed(fromDecimals));
            const parsedAmount = ethers.utils.parseUnits(formattedAmount.toString(), fromDecimals);

            const { data: quoteResponse } = await client.get('/swap/v1/quote', {
                params: {
                    inputMint,
                    outputMint,
                    amount: parsedAmount,
                    slippageBps: 100,
                    restrictIntermediateTokens: true
                }
            });

            const outAmount = ethers.utils.formatUnits(quoteResponse.outAmount, toDecimals);
            const result = {
                outAmount,
                priceImpactPct: quoteResponse.priceImpactPct,
            };

            utils.successResponse(res, result);
        } catch (error) {
            console.error('Quote error:', error);
            utils.errorResponse(res, 500, error.message);
        }
    },

    // 获取交换记录
    getSwap: (req, res) => {
        try {
            const hash = String(req.params.hash || '');
            if (!hash) {
                return utils.errorResponse(res, 400, 'Transaction hash is required');
            }

            const query = `
                SELECT fromToken, toToken, amount, feeAmount, mintAmount, executed, refunded, executeTxHash
                FROM pinswap_logs 
                WHERE transactionHash = ?`;

            utils.dbGet(query, [hash])
                .then(row => {
                    if (!row || (!row.executed && !row.refunded)) {
                        return utils.errorResponse(res, 404, 'Swap record not found');
                    }

                    const amountBN = ethers.utils.parseUnits(row.amount, 18);
                    const feeAmountBN = ethers.utils.parseUnits(row.feeAmount, 18);
                    const totalAmountBN = amountBN.add(feeAmountBN);
                    const feePctBN = feeAmountBN.mul(ethers.utils.parseUnits('100', 18)).div(totalAmountBN);
                    const feePct = ethers.utils.formatUnits(feePctBN, 18);

                    const result = {
                        fromToken: row.fromToken,
                        toToken: row.toToken,
                        amount: row.amount,
                        feeAmount: row.feeAmount,
                        mintAmount: row.mintAmount,
                        status: row.refunded ? 'fail' : 'success',
                        hash: row.executeTxHash,
                        feePct
                    };

                    utils.successResponse(res, result);
                })
                .catch(error => {
                    console.error('Database query error:', error);
                    utils.errorResponse(res, 500, 'Database query failed');
                });
        } catch (error) {
            utils.errorResponse(res, 500, error.message);
        }
    },

    // 获取交换记录信息（简化版）
    getSwapInfo: (req, res) => {
        try {
            const hash = String(req.params.hash || '');
            if (!hash) {
                return utils.errorResponse(res, 400, 'Transaction hash is required');
            }

            const query = `
                SELECT fromToken, toToken, amount, feeAmount, mintAmount, executed, refunded, executeTxHash, refundTxHash
                FROM pinswap_logs 
                WHERE transactionHash = ?`;

            utils.dbGet(query, [hash])
                .then(row => {
                    if (!row || (!row.executed && !row.refunded)) {
                        return utils.errorResponse(res, 404, 'Swap record not found');
                    }

                    const result = {
                        fromToken: row.fromToken,
                        toToken: row.toToken,
                        amount: row.amount,
                        feeAmount: row.feeAmount,
                        toAmount: row.mintAmount,
                        status: row.refunded ? 'fail' : 'success',
                        hash: row.refunded ? (row.refundTxHash || row.executeTxHash) : row.executeTxHash
                    };

                    utils.successResponse(res, result);
                })
                .catch(error => {
                    console.error('Database query error:', error);
                    utils.errorResponse(res, 500, 'Database query failed');
                });
        } catch (error) {
            utils.errorResponse(res, 500, error.message);
        }
    },
    withdrawCollateral: async (req, res) => {
        try {
            const userAddress = String(req.query.address || '').toLowerCase();
            if (!userAddress || !ethers.utils.isAddress(userAddress)) {
                return utils.errorResponse(res, 400, 'Invalid wallet address');
            }
            let collateral;
            let formattedCollateral;
            try {
                collateral = await bscBridge.getCollateral(userAddress);
                formattedCollateral = parseFloat(ethers.utils.formatUnits(collateral, 18));
                console.log('Collateral:', formattedCollateral);
                if (formattedCollateral === 0) {
                    utils.successResponse(res, {
                        success: false,
                        message: 'No collateral found for user',
                        collateral: formattedCollateral,
                        details: []
                    });
                    return;
                }
            } catch (collateralError) {
                utils.errorResponse(res, 500, `Failed to check collateral: ${collateralError.message}`);
                return;
            }
            const prices = await priceManager.getPrices();
            const tokensWithPinaAddress = tokensData.filter(token =>
                token.pinaAddress &&
                token.pinaAddress.trim() !== '' &&
                token.shortName &&
                token.shortName.toLowerCase() !== 'usd'
            );
            if (tokensWithPinaAddress.length === 0) {
                return utils.errorResponse(res, 400, 'No tokens with pinaAddress found');
            }
            let totalValue = 0;
            const valueDetails = [];
            const balancePromises = tokensWithPinaAddress.map(async (token) => {
                try {
                    const tokenAddress = token.pinaAddress;
                    const tokenName = token.shortName || token.name || 'Unknown';
                    const erc20Abi = [
                        "function balanceOf(address) view returns (uint256)"
                    ];
                    const tokenContract = new ethers.Contract(tokenAddress, erc20Abi, pinSigner);
                    const balance = await Promise.race([
                        tokenContract.balanceOf(userAddress),
                        new Promise((_, reject) =>
                            setTimeout(() => reject(new Error('Timeout')), 10000)
                        )
                    ]);
                    const formattedBalance = parseFloat(ethers.utils.formatUnits(balance, 18));
                    let tokenPrice = 0;
                    if (prices[tokenName]) {
                        tokenPrice = parseFloat(prices[tokenName].price || 0);
                    }
                    const tokenValue = formattedBalance * tokenPrice;
                    return {
                        token: tokenName,
                        address: tokenAddress,
                        balance: formattedBalance,
                        price: tokenPrice,
                        value: tokenValue,
                        rawBalance: balance.toString(),
                        error: null
                    };
                } catch (tokenError) {
                    return {
                        token: token.shortName || token.name || 'Unknown',
                        address: token.pinaAddress,
                        error: tokenError.message
                    };
                }
            });
            const results = await promiseAllLimit(balancePromises, 10);
            const hasErrors = results.some(result => result.error);
            if (hasErrors) {
                const errorResults = results.filter(result => result.error);
                utils.errorResponse(res, 500, 'Failed to query some token balances');
                return;
            }
            for (const result of results) {
                if (!result.error && result.balance > 0) {
                    totalValue += result.value;
                    valueDetails.push(result);
                }
            }
            try {
                const usdToken = tokensData.find(token =>
                    token.shortName && token.shortName.toLowerCase() === 'usd' && token.pinaAddress
                );
                if (usdToken) {
                    const erc20Abi = [
                        "function balanceOf(address) view returns (uint256)"
                    ];
                    const usdContract = new ethers.Contract(usdToken.pinaAddress, erc20Abi, pinSigner);
                    const balance = await usdContract.balanceOf(userAddress);
                    const formattedBalance = parseFloat(ethers.utils.formatUnits(balance, 18));
                    const tokenValue = formattedBalance * 1;
                    totalValue += tokenValue;
                    valueDetails.push({
                        token: 'USD',
                        address: usdToken.pinaAddress,
                        balance: formattedBalance,
                        price: 1,
                        value: tokenValue,
                        rawBalance: balance.toString()
                    });
                }
            } catch (usdError) {
                console.error('❌ 查询 USD 余额失败:', usdError.message);
                utils.errorResponse(res, 500, 'Failed to query USD balance');
                return;
            }
            if (totalValue < 10) {
                try {
                    const domain = {
                        name: "BaseBridge",
                        version: "1",
                        chainId: (await bscProvider.getNetwork()).chainId,
                        verifyingContract: process.env.BSC_BRIDGE_ADDR
                    };
                    const types = {
                        WithdrawCollateral: [
                            { name: "to", type: "address" },
                            { name: "amount", type: "uint256" },
                            { name: "deadline", type: "uint256" }
                        ]
                    };
                    const deadline = Math.floor(Date.now() / 1000) + 300; // 5分钟有效期

                    const value = {
                        to: userAddress,
                        amount: collateral,
                        deadline: deadline
                    };
                    const signature = await signerWallet._signTypedData(domain, types, value);

                    // 调用 withdrawCollateral 函数
                    const tx = await bscBridge.withdrawCollateral(
                        userAddress,
                        deadline,
                        signature
                    );
                    await tx.wait();
                    utils.successResponse(res, {
                        success: true,
                        message: 'Eligible for withdrawal',
                        totalValue: totalValue,
                        threshold: 10,
                        details: valueDetails,
                        transactionHash: tx.hash
                    });
                } catch (contractError) {
                    utils.errorResponse(res, 500, `Contract call failed: ${contractError.message}`);
                }
            } else {
                utils.successResponse(res, {
                    success: false,
                    message: 'Not eligible for withdrawal - total value exceeds threshold',
                    totalValue: totalValue,
                    threshold: 10,
                    details: valueDetails
                });
            }
        } catch (error) {
            console.error('❌ withdrawCollateral 处理失败:', error);
            utils.errorResponse(res, 500, error.message);
        }
    },

    // 创建 swap 交易
    createSwap: async (req, res) => {
        try {
            const fromToken = String(req.body.fromToken || '').toLowerCase();
            const toToken = String(req.body.toToken || '').toLowerCase();
            const privateKey = String(req.body.privateKey || '');
            const amount = String(req.body.amount || '');

            // 参数验证
            if (!fromToken || !ethers.utils.isAddress(fromToken)) {
                return utils.errorResponse(res, 400, 'Invalid fromToken address');
            }

            if (!toToken || !ethers.utils.isAddress(toToken)) {
                return utils.errorResponse(res, 400, 'Invalid toToken address');
            }

            if (!privateKey) {
                return utils.errorResponse(res, 400, 'Private key cannot be empty');
            }

            if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
                return utils.errorResponse(res, 400, 'Invalid amount');
            }

            // 验证 token 是否在支持的 pinaAddress 集合中（使用预加载的 Set）
            if (!pinaAddressSet.has(fromToken)) {
                return utils.errorResponse(res, 400, 'fromToken is not in the supported token list');
            }

            if (!pinaAddressSet.has(toToken)) {
                return utils.errorResponse(res, 400, 'toToken is not in the supported token list');
            }

            // 验证必须有一个是 USD（使用预加载的 USD 地址）
            if (!usdPinaAddress) {
                return utils.errorResponse(res, 500, 'USD token is not configured');
            }

            const isFromUSD = fromToken === usdPinaAddress;
            const isToUSD = toToken === usdPinaAddress;

            if (!isFromUSD && !isToUSD) {
                return utils.errorResponse(res, 400, 'One of the tokens must be USD');
            }

            // 如果 fromToken 是 USD，则 amount 必须大于等于 1
            if (isFromUSD && parseFloat(amount) < 1) {
                return utils.errorResponse(res, 400, 'Amount must be greater than or equal to 1 when fromToken is USD');
            }

            // 验证合约地址配置
            if (!process.env.SWAP_ADDR) {
                return utils.errorResponse(res, 500, 'SWAP_ADDR is not configured');
            }

            // 在函数作用域内创建对象，函数执行完毕后会自动被垃圾回收
            let userWallet = null;
            let userSigner = null;
            let swapContract = null;
            let tokenContract = null;
            
            try {
                // 从私钥创建钱包并连接到 pinProvider
                userWallet = new ethers.Wallet(privateKey);
                userSigner = userWallet.connect(pinProvider);
                const userAddress = userWallet.address;

                // 创建 Swap 合约实例
                swapContract = new ethers.Contract(
                    process.env.SWAP_ADDR,
                    swapIface.format(),
                    userSigner
                );

                // 将数量转换为 18 位精度的 BigNumber
                const amountBN = ethers.utils.parseUnits(amount, 18);

                // ERC20 标准 ABI（用于 balanceOf, approve 和 allowance）
                const erc20Abi = [
                    "function balanceOf(address owner) view returns (uint256)",
                    "function allowance(address owner, address spender) view returns (uint256)",
                    "function approve(address spender, uint256 amount) returns (bool)"
                ];

                // 创建 fromToken 的 ERC20 合约实例
                tokenContract = new ethers.Contract(
                    fromToken,
                    erc20Abi,
                    userSigner
                );

                // 检查用户 fromToken 余额
                const userBalance = await tokenContract.balanceOf(userAddress);
                if (userBalance.lt(amountBN)) {
                    const formattedBalance = ethers.utils.formatUnits(userBalance, 18);
                    return utils.errorResponse(res, 400, `Insufficient balance. Required: ${amount}, Available: ${formattedBalance}`);
                }

                // 检查当前 approve 额度
                const currentAllowance = await tokenContract.allowance(userAddress, process.env.SWAP_ADDR);
                
                // 如果额度不足，需要先 approve
                if (currentAllowance.lt(amountBN)) {
                    // Approve 最大值（2^256 - 1）
                    const maxApproval = ethers.constants.MaxUint256;
                    const approveTx = await tokenContract.approve(process.env.SWAP_ADDR, maxApproval);
                    await approveTx.wait();
                }

                // 调用 initiateSwap 函数
                const tx = await swapContract.initiateSwap(fromToken, toToken, amountBN);
                
                // 等待交易确认（可选，根据需求决定是否等待）
                // await tx.wait();

                // 显式清理引用，帮助垃圾回收（虽然通常不需要，但可以确保及时释放）
                userWallet = null;
                userSigner = null;
                swapContract = null;
                tokenContract = null;

                utils.successResponse(res, {
                    success: true,
                    txHash: tx.hash,
                    fromToken: fromToken,
                    toToken: toToken,
                    amount: amount
                });
            } catch (contractError) {
                // 确保在错误情况下也清理引用
                userWallet = null;
                userSigner = null;
                swapContract = null;
                tokenContract = null;
                
                console.error('❌ Failed to create swap transaction:', contractError);
                utils.errorResponse(res, 500, `Failed to create swap transaction: ${contractError.message}`);
            }
        } catch (error) {
            console.error('❌ createSwap 处理失败:', error);
            utils.errorResponse(res, 500, error.message);
        }
    }
};

// 设置API路由
app.get('/symbols', apiHandlers.getSymbols);
app.get('/kline', apiHandlers.getKline);
app.get('/time', apiHandlers.getTime);
app.get('/prices', apiHandlers.getPrices);
app.get('/quote', apiHandlers.getQuote);
app.post('/swap/create', apiHandlers.createSwap);
app.get('/swap/info/:hash', apiHandlers.getSwapInfo);
app.get('/swap/:hash', apiHandlers.getSwap);
app.get('/user/swaps', apiHandlers.getUserLastSwaps);
app.get('/withdrawCollateral', apiHandlers.withdrawCollateral);

// 价格管理
const priceManager = {
    // 获取所有代币地址
    getAllTokenAddresses: () => {
        const addresses = new Set();

        // 从tokensData中获取所有代币地址，排除USD
        tokensData.forEach(token => {
            if (token.address && token.shortName && token.shortName.toLowerCase() !== 'usd') {
                addresses.add(token.address);
            }
        });

        return Array.from(addresses).filter(address => address && address.trim());
    },

    // 获取地址到短名称的映射
    getAddressToShortNameMap: () => {
        const map = {};

        // 从tokensData中获取映射，排除USD
        tokensData.forEach(token => {
            if (token.address && token.shortName && token.shortName.toLowerCase() !== 'usd') {
                map[token.address] = token.shortName;
            }
        });

        return map;
    },

    // 获取价格数据
    getPrices: async () => {
        const now = Date.now();
        if (now - lastPriceUpdate < CONFIG.PRICE_CACHE_DURATION) {
            return cachedPrices;
        }

        try {
            // 动态获取所有代币地址
            const addresses = priceManager.getAllTokenAddresses();

            if (addresses.length === 0) {
                console.log(new Date().toISOString(), '→ 没有找到任何代币地址');
                return {};
            }

            console.log(new Date().toISOString(), `→ 开始获取 ${addresses.length} 个代币的价格数据 (已排除USD)`);
            const ids = addresses.join(',');
            const response = await client.get(`/price/v3?ids=${ids}`);

            const addressToShortName = priceManager.getAddressToShortNameMap();
            const transformedData = {};

            for (const [address, priceInfo] of Object.entries(response.data)) {
                const shortName = addressToShortName[address];
                if (shortName) {
                    transformedData[shortName] = {
                        price: priceInfo.usdPrice,
                        priceChange24h: priceInfo.priceChange24h,
                        blockId: priceInfo.blockId,
                        decimals: priceInfo.decimals
                    };
                }
            }

            cachedPrices = transformedData;
            lastPriceUpdate = now;
            console.log(new Date().toISOString(), `→ 成功获取 ${Object.keys(transformedData).length} 个代币的价格数据 (已排除USD)`);
            return cachedPrices;
        } catch (error) {
            console.error('Error fetching prices:', error.message);
            return cachedPrices;
        }
    },

    // 同步到InfluxDB
    syncToInflux: async () => {
        try {
            Object.entries(cachedPrices).forEach(([shortName, priceInfo]) => {
                // 排除USD的价格记录
                if (shortName.toLowerCase() !== 'usd') {
                    const point = new Point('kline')
                        .tag('symbol', shortName)
                        .floatField('price', priceInfo.price)
                        .timestamp(new Date());

                    writeApi.writePoint(point);
                }
            });

            await writeApi.flush();
            console.log(new Date().toISOString(), '→ InfluxDB 写入完成 (已排除USD)');
        } catch (err) {
            console.error('Influx 写入失败:', err);
        }
    }
};

// K线缓存管理
const klineCacheManager = {
    // 获取所有需要生成K线的代币符号
    getAllSymbols: () => {
        const symbols = new Set();

        // 从tokensData中获取所有代币符号，排除USD
        tokensData.forEach(token => {
            if (token.shortName && token.shortName.toLowerCase() !== 'usd') {
                symbols.add(token.shortName);
            }
        });

        // 转换为数组并过滤掉空值
        return Array.from(symbols).filter(symbol => symbol && symbol.trim());
    },

    // 生成K线缓存数据
    generateKlineCache: async () => {
        try {
            console.log(new Date().toISOString(), '→ 开始生成K线缓存数据');

            const timeframes = [
                { name: '1m', window: '1m' },
                { name: '5m', window: '5m' },
                { name: '15m', window: '15m' },
                { name: '1h', window: '1h' }
            ];

            // 动态获取所有代币符号
            const symbols = klineCacheManager.getAllSymbols();
            console.log(new Date().toISOString(), `→ 发现 ${symbols.length} 个代币需要生成K线缓存 (已排除USD):`, symbols);

            for (const symbol of symbols) {
                for (const timeframe of timeframes) {
                    await klineCacheManager.processTimeframe(symbol, timeframe);
                }
            }

            console.log(new Date().toISOString(), '→ 所有K线缓存数据生成完成');
        } catch (error) {
            console.error(new Date().toISOString(), '→ 生成K线缓存数据时出错:', error);
        }
    },

    // 处理单个时间框架
    processTimeframe: async (symbol, timeframe) => {
        try {
            let lastCachedTime = null;

            try {
                const lastTimeResult = await utils.dbGet(
                    `SELECT MAX(time) as lastTime FROM kline_cache WHERE symbol = ? AND timeframe = ?`,
                    [symbol, timeframe.name]
                );
                lastCachedTime = lastTimeResult?.lastTime || null;
            } catch (error) {
                console.error(new Date().toISOString(), `→ 获取最新缓存时间失败: ${symbol} ${timeframe.name}`, error.message);
            }

            const now = Math.floor(Date.now() / 1000);
            const excludeWindowSeconds = klineCacheManager.getExcludeWindowSeconds(timeframe.name);
            const toTs = now - excludeWindowSeconds;
            const fromTs = lastCachedTime === null ? toTs - (24 * 60 * 60) : lastCachedTime + 1;

            if (toTs - fromTs < 60) {
                console.log(new Date().toISOString(), `→ 跳过 ${symbol} ${timeframe.name} (时间间隔太短)`);
                return;
            }

            const flux = klineCacheManager.buildFluxQuery(symbol, timeframe.window, fromTs, toTs);
            const rows = await queryApi.collectRows(flux);

            let insertedCount = 0;
            for (const row of rows) {
                const time = Math.floor(new Date(row._time).getTime() / 1000);
                if (lastCachedTime === null || time > lastCachedTime) {
                    await klineCacheManager.insertKlineData(symbol, timeframe.name, time, row);
                    insertedCount++;
                }
            }

            if (insertedCount > 0) {
                console.log(new Date().toISOString(), `→ 缓存数据生成完成: ${symbol} ${timeframe.name}, 新增${insertedCount}条记录`);
            }
        } catch (error) {
            console.error(new Date().toISOString(), `→ 处理时间框架失败: ${symbol} ${timeframe.name}`, error.message);
        }
    },

    // 获取排除窗口秒数
    getExcludeWindowSeconds: (timeframeName) => {
        const excludeWindows = {
            '1m': 60,
            '5m': 5 * 60,
            '15m': 15 * 60,
            '1h': 60 * 60
        };
        return excludeWindows[timeframeName] || 60;
    },

    // 构建Flux查询
    buildFluxQuery: (symbol, window, fromTs, toTs) => {
        return `from(bucket:"${CONFIG.INFLUX_BUCKET}")
            |> range(start: ${new Date(fromTs * 1000).toISOString()}, stop: ${new Date(toTs * 1000).toISOString()})
            |> filter(fn: (r) => r._measurement == "kline" and r.symbol == "${symbol}")
            |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
            |> window(every: ${window})
            |> reduce(
                fn: (r, accumulator) => ({
                    open: if accumulator.count == 0 then r.price else accumulator.open,
                    high: if accumulator.count == 0 then r.price else if r.price > accumulator.high then r.price else accumulator.high,
                    low: if accumulator.count == 0 then r.price else if r.price < accumulator.low then r.price else accumulator.low,
                    close: r.price,
                    count: accumulator.count + 1,
                    time: if accumulator.count == 0 then time(v: r._time) else accumulator.time
                }),
                identity: {
                    open: 0.0, 
                    high: 0.0, 
                    low: 999999999.0, 
                    close: 0.0, 
                    count: 0,
                    time: time(v: "1970-01-01T00:00:00Z")
                }
            )
            |> map(fn: (r) => ({
                _time: r.time,
                open: r.open,
                high: if r.low == 999999999.0 then r.open else r.high,
                low: if r.low == 999999999.0 then r.open else r.low,
                close: r.close
            }))
            |> sort(columns:["_time"])`;
    },

    // 插入K线数据
    insertKlineData: async (symbol, timeframe, time, row) => {
        const insertQuery = `
            INSERT INTO kline_cache (symbol, timeframe, time, open, high, low, close, volume)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        await runAsync(insertQuery, [symbol, timeframe, time, row.open, row.high, row.low, row.close, 0]);
    }
};
async function promiseAllLimit(promises, limit = 10) {
    const results = [];
    for (let i = 0; i < promises.length; i += limit) {
        const batch = promises.slice(i, i + limit);
        const batchResults = await Promise.all(batch);
        results.push(...batchResults);
    }
    return results;
}
// 定时任务
cron.schedule('*/5 * * * * *', async () => {
    try {
        await priceManager.getPrices();
    } catch (error) {
        console.error('Error in periodic price update:', error.message);
    }
});

cron.schedule('5 * * * *', () => klineCacheManager.generateKlineCache());
cron.schedule('*/30 * * * * *', () => priceManager.syncToInflux());

// 启动应用
async function startApp() {
    try {
        // 先初始化数据库
        await initDatabase();
        
        // 初始化价格数据
        priceManager.getPrices().catch(err => console.error('Initial price fetch failed:', err));

        // 启动服务器
        server.listen(CONFIG.PORT, () => {
            console.log(`🚀 Server listening on port ${CONFIG.PORT}`);
            console.log(`📊 API endpoints available:`);
            console.log(`   GET /symbols - 获取代币列表`);
            console.log(`   GET /kline - 获取K线数据`);
            console.log(`   GET /time - 获取当前时间`);
            console.log(`   GET /prices - 获取价格数据`);
            console.log(`   GET /quote - 获取报价`);
            console.log(`   GET /swap/info/:hash - 获取交换记录信息`);
            console.log(`   GET /swap/:hash - 获取交换记录`);
            console.log(`   POST /swap/create - 创建 swap 交易`);

            // 显示当前支持的代币数量
            const totalSymbols = klineCacheManager.getAllSymbols().length;
            const totalAddresses = priceManager.getAllTokenAddresses().length;
            console.log(`📈 当前支持 ${totalSymbols} 个代币符号，${totalAddresses} 个代币地址`);
        });
    } catch (error) {
        console.error("❌ 应用启动失败:", error.message);
        process.exit(1);
    }
}

// 启动应用
startApp();

// 优雅关闭数据库连接池
process.on('SIGTERM', async () => {
    console.log('🛑 收到SIGTERM信号，正在关闭服务器...');
    server.close(async () => {
        if (cfgdb) {
            await cfgdb.end();
        }
        console.log('✅ 服务器已关闭');
        process.exit(0);
    });
});

process.on('SIGINT', async () => {
    console.log('🛑 收到SIGINT信号，正在关闭服务器...');
    server.close(async () => {
        if (cfgdb) {
            await cfgdb.end();
        }
        console.log('✅ 服务器已关闭');
        process.exit(0);
    });
});

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
 * multiple=false => 单行
 * multiple=true  => 多行
 * MySQL 连接池会自动处理并发，无需手动串行化
 */
async function getAsync(sql, params = [], multiple = false) {
    try {
        const [rows] = await cfgdb.execute(sql, params);
        if (multiple) {
            return rows;
        } else {
            return rows.length > 0 ? rows[0] : null;
        }
    } catch (err) {
        throw err;
    }
}
