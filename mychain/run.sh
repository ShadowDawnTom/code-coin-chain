#!/bin/bash
# 设置密码和私钥
PASSWORD="saiu8iudq13612897ebicsabisaib1963ydsasjbc"
PRIVATE_KEY="db80d07fa94346222f60f83f189a38a240b8477de6e4c411ba753fe585f8c454"

# 创建必要的目录
mkdir -p ~/mychain/gethdata-miner
mkdir -p ~/mychain/gethdata-rpc

# 创建临时密码文件（设置严格权限）
echo "$PASSWORD" > /tmp/geth_pass_secure.txt
chmod 600 /tmp/geth_pass_secure.txt

# 创建临时私钥文件
echo -n "$PRIVATE_KEY" > /tmp/geth_privkey_secure.txt
chmod 600 /tmp/geth_privkey_secure.txt

# 导入账户到矿工节点数据目录
echo "正在导入账户到矿工节点..."
sudo docker run --rm \
  -v /home/freemanbgk01/mychain/gethdata-miner:/root/.ethereum \
  -v /tmp/geth_privkey_secure.txt:/privkey.txt:ro \
  -v /tmp/geth_pass_secure.txt:/pass.txt:ro \
  ethereum/client-go:v1.13.14 \
  account import --password /pass.txt /privkey.txt

# 导入账户到RPC节点数据目录
echo "正在导入账户到RPC节点..."
sudo docker run --rm \
  -v /home/freemanbgk01/mychain/gethdata-rpc:/root/.ethereum \
  -v /tmp/geth_privkey_secure.txt:/privkey.txt:ro \
  -v /tmp/geth_pass_secure.txt:/pass.txt:ro \
  ethereum/client-go:v1.13.14 \
  account import --password /pass.txt /privkey.txt

# 清理私钥文件
rm -f /tmp/geth_privkey_secure.txt

# 初始化矿工节点区块链
echo "正在初始化矿工节点区块链..."
sudo docker run --rm \
  -v /home/freemanbgk01/mychain/gethdata-miner:/root/.ethereum \
  -v /home/freemanbgk01/mychain/genesis.json:/genesis.json \
  ethereum/client-go:v1.13.14 \
  --state.scheme path \
  init /genesis.json

# 初始化RPC节点区块链
echo "正在初始化RPC节点区块链..."
sudo docker run --rm \
  -v /home/freemanbgk01/mychain/gethdata-rpc:/root/.ethereum \
  -v /home/freemanbgk01/mychain/genesis.json:/genesis.json \
  ethereum/client-go:v1.13.14 \
  --state.scheme path \
  init /genesis.json

# 停止现有容器（如果有）
echo "停止现有容器..."
sudo docker compose -f geth.yml down --remove-orphans

# 启动双节点
echo "正在启动双节点..."
sudo docker compose -f geth.yml up -d

# 等待节点启动并解锁账户
echo "等待节点启动并解锁账户..."
sleep 15

# 立即删除密码文件（一次性使用）
echo "删除临时密码文件..."
rm -f /tmp/geth_pass_secure.txt

echo "双节点部署完成！"
echo "- 矿工节点: 只产块，不开放端口，数据目录: /home/freemanbgk01/mychain/gethdata-miner"
echo "- RPC节点: 开放访问，不产块，数据目录: /home/freemanbgk01/mychain/gethdata-rpc"
echo "- HTTP端口: 8545"
echo "- WebSocket端口: 8546"
echo "- 密码文件已安全删除"

