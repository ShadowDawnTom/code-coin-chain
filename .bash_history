docker ps
vim envs/common-blockscout.env
docker logs 9762a07d632f --tail=50
cd blockscout/docker-compose/env
cd blockscout/docker-compose/envs/
vim common-user-ops-indexer.env 
cd ..
docker compose -f geth.yml down
docker compose -f geth.yml up -d
docker ps
vim envs/common-blockscout.env 
ls
vim envs/common-user-ops-indexer.env 
docker compose -f geth.yml down
docker compose -f geth.yml up -d
docker ps
vim envs/common-blockscout.env 
docker compose -f geth.yml down
docker compose -f geth.yml up -d
docker ps
curl -X POST   -H "Content-Type: application/json"   -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'   http://34.66.172.76:8545
curl -X POST   -H "Content-Type: application/json"   -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'   https://rpc.yat-chain.com
cd blockscout/docker-compose/
vim envs/common-blockscout.env 
docker compose -f geth.yml down
docker compose -f geth.yml up -d
docker ps
docker logs 59d719381412 --tail=50
vim envs/common-blockscout.env 
docker compose -f geth.yml down
docker compose -f geth.yml up -d
docker ps
vim envs/common-blockscout.env 
vim envs/common-frontend.env 
docker compose -f geth.yml down
docker compose -f geth.yml up -d
docekr ps
docker ps
cd /etc/nginx/sites-enabled/
sudo vim rpc.yat-chain.com.conf 
sudo service nginx restart
docker ps
curl -X POST   -H "Content-Type: application/json"   -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'   http://rpc.yat-chain.com
curl -X POST   -H "Content-Type: application/json"   -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'   https://rpc.yat-chain.com
curl -X POST   -H "Content-Type: application/json"   -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'   http://rpc.yat-chain.com
sudo service nginx -t
sudo service nginx restart
curl -X POST   -H "Content-Type: application/json"   -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'   http://rpc.yat-chain.com
sudo vim rpc.yat-chain.com.conf 
lsblk
sudo service nginx restart
cd ~/blockscout/docker-compose/
docker ps
docker compose -f geth.yml down
curl -X POST   -H "Content-Type: application/json"   -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'   http://rpc.yat-chain.com
docker compose -f geth.yml up -d
docker ps
docker compose -f geth.yml up -d
docker ps
docker log user-ops-indexer --tail=50
docker logs user-ops-indexer --tail=50
ls
curl -X POST   -H "Content-Type: application/json"   -d '{"jsonrpc":"2.0","method":"eth_getCode","params":["0x5ff137d4b0fdcd49dca30c7cf57e578a026d2789", "latest"],"id":1}'   https://rpc.yat-chain.com
curl -X POST   -H "Content-Type: application/json"   -d '{"jsonrpc":"2.0","method":"eth_getCode","params":["0x5ff137d4b0fdcd49dca30c7cf57e578a026d2789", "latest"],"id":1}'   http://rpc.yat-chain.com
vim envs/common-blockscout.env 
vim envs/common-frontend.env 
docker exec -it user-ops-indexer sh
docker ps
docker logs backend --tail=50
docker logs geth --tail=50
docker exec -it user-ops-indexer sh
docker compose -f geth.yml down
cd ~/blockscout/docker-compose/
docker compose -f geth.yml down
vim envs/common-blockscout.env 
docker compose -f geth.yml up -d
docker ps
docker logs user-ops-indexer --tail=50
docker compose -f geth.yml down
vim envs/common-blockscout.env 
vim envs/common-frontend.env 
docker compose -f geth.yml up -d
docker ps
docker compose -f geth.yml down
sudo vim envs/common-frontend.env 
docker compose -f geth.yml up -d
docker ps
curl http://localhost:8080/api/v1/pages/main
docker ps
docker logs user-ops-indexer --tail=50
docker ps
docker logs backend --tail=50
docker compose -f geth.yml down
cd blockscout/
ls
docker compose -f geth.yml down
cd docker-compose/
docker compose -f geth.yml down
clear
sudo docker compose -f geth.yml up -d
docker ps
docker logs user-ops-indexer --tail=50
vim envs/common-blockscout.env 
sudo vim envs/common-blockscout.env 
docker compose -f geth.yml down
sudo docker compose -f geth.yml up -d
docker ps
docker logs user-ops-indexer --tail=50
sudo vim envs/common-user-ops-indexer.env 
docker compose -f geth.yml down
sudo docker compose -f geth.yml up -d
docker ps
docker compose -f geth.yml down
cd ~/
ls
rm -rf blockscout
sudo rm -rf blockscout
ls
git clone https://github.com/blockscout/blockscout.git
cd blockscout/docker-compose/envs/
ls
vim common-blockscout.env 
vim common-frontend.env 
sudo docker compose -f geth.yml up -d
cd ..
sudo docker compose -f geth.yml up -d
sudo vim services/nginx.yml 
docker compose -f geth.yml down
sudo docker compose -f geth.yml up -d
docker ps
vim envs/common-frontend.env 
docker ps
docker compose -f geth.yml down
sudo docker compose -f geth.yml up -d
docker ps
vim envs/common-frontend.env 
docker compose -f geth.yml down
sudo docker compose -f geth.yml up -d
docker ps
docker logs user-ops-indexer --tail=50
curl -s -X POST http://rpc.yat-chain.com   -H "Content-Type: application/json"   -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "eth_supportedEntryPoints",
    "params": []
  }'
cd blockscout/docker-compose/
sudo vim envs/common-frontend.env 
docker compose -f geth.yml down
sudo docker compose -f geth.yml up -d
sudo vim /etc/nginx/sites-enabled/scan.yat-chain.com.conf 
sudo service nginx restart
sudo vim envs/common-frontend.env 
docker compose -f geth.yml down
sudo docker compose -f geth.yml up -d
sudo vim envs/common-frontend.env 
sudo docker compose -f geth.yml up -d
sudo vim /etc/nginx/sites-enabled/scan.yat-chain.com.conf 
sudo service nginx restart
curl http://localhost:81/api/v2/stats
curl localhost:81/api/v2/stats
docker ps
curl -s http://127.0.0.1:4000/api/v2/config/backend-version
docker ps | grep blockscout
curl -s http://localhost:3000/api/v2/config/backend-version
curl -s http://localhost:81/api/v2/config/backend-version
curl -s http://localhost:8
curl -s http://localhost:81
clear
docker logs backend --tail=100
docker ps
cd blockscout/docker-compose/
docker compose -f geth.yml down
sudo docker compose -f geth.yml up -d
curl -s http://localhost:81
clear
history 30
curl -s http://localhost:81/api/v2/config/backend-version
docker logs backend --tail=100
docker ps
ls
sudo vim envs/common-blockscout.env 
docker compose -f geth.yml down
sudo docker compose -f geth.yml up -d
docker logs backend --tail=50
docker exec -it backend sh -lc 'curl -i http://localhost:4000/api/v2/config/backend-version'
4% Blocks Indexed – We're indexing this chain right now. Some of the counts may be inaccurate.
curl -s -X POST http://rpc.yat-chain.com   -H "Content-Type: application/json"   -d '{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber","params":[]}' | jq -r '.result' | xargs printf "%d\n"
sudo docker exec bsc-geth-rpc sh -lc 'geth attach --exec net.peerCount ipc:/root/.ethereum/geth.ipc'
sudo docker exec bsc-geth-miner sh -lc 'geth attach --exec "admin.nodeInfo.enode" ipc:/root/.ethereum/geth.ipc'
sudo docker exec bsc-geth-rpc sh -lc 'geth attach --exec "admin.addPeer(\"enode://7b3217465e0441753d5c2afcc2ce894acf7feb32a8dc218a4c677ec490bbea8f11b3eda42d514c195be2db9d7999da068deaba87ad7e307ba62b47d95052b216@127.0.0.1:30303\")" ipc:/root/.ethereum/geth.ipc'
sudo docker exec bsc-geth-rpc sh -lc 'geth attach --exec net.peerCount ipc:/root/.ethereum/geth.ipc'
sudo docker exec bsc-geth-rpc sh -lc 'geth attach --exec admin.peers ipc:/root/.ethereum/geth.ipc'
sudo docker exec bsc-geth-miner sh -lc 'geth attach --exec "admin.nodeInfo.enode" ipc:/root/.ethereum/geth.ipc'
docker ps
history | grep addPeer
sudo docker exec bsc-geth-rpc sh -lc 'geth attach --exec "admin.addPeer(\"enode://7b3217465e0441753d5c2afcc2ce894acf7feb32a8dc218a4c677ec490bbea8f11b3eda42d514c195be2db9d7999da068deaba87ad7e307ba62b47d95052b216@bsc-geth-miner:30303\")" ipc:/root/.ethereum/geth.ipc'
sudo docker exec bsc-geth-rpc sh -lc 'geth attach --exec net.peerCount ipc:/root/.ethereum/geth.ipc'
history|grep peerCount
sudo docker exec bsc-geth-rpc sh -lc 'geth attach --exec net.peerCount ipc:/root/.ethereum/geth.ipc'
sudo docker exec bsc-geth-miner sh -lc 'geth attach --exec "admin.nodeInfo.enode" ipc:/root/.ethereum/geth.ipc'
sudo sudo docker exec bsc-geth-rpc sh -lc 'geth attach --exec "admin.addPeer(\"enode://7b3217465e0441753d5c2afcc2ce894acf7feb32a8dc218a4c677ec490bbea8f11b3eda42d514c195be2db9d7999da068deaba87ad7e307ba62b47d95052b216@bsc-geth-miner:30303?discport=0\")" ipc:/root/.ethereum/geth.ipc'
sudo docker exec bsc-geth-rpc sh -lc 'geth attach --exec net.peerCount ipc:/root/.ethereum/geth.ipc'
sudo docker exec bsc-geth-miner sh -lc 'geth attach --exec "admin.nodeInfo.enode" ipc:/root/.ethereum/geth.ipc'
sudo docker exec bsc-geth-rpc sh -lc 'geth attach --exec "admin.addPeer(\"enode://7b3217465e0441753d5c2afcc2ce894acf7feb32a8dc218a4c677ec490bbea8f11b3eda42d514c195be2db9d7999da068deaba87ad7e307ba62b47d95052b216@127.0.0.1:30303?discport=0")" ipc:/root/.ethereum/geth.ipc'
sudo docker exec bsc-geth-rpc sh -lc 'geth attach --exec "admin.peers" ipc:/root/.ethereum/geth.ipc'
sudo docker network connect docker-compose_default bsc-geth-rpc
sudo docker exec bsc-geth-rpc sh -lc 'geth attach --exec "admin.addPeer(\"enode://7b3217465e0441753d5c2afcc2ce894acf7feb32a8dc218a4c677ec490bbea8f11b3eda42d514c195be2db9d7999da068deaba87ad7e307ba62b47d95052b216@127.0.0.1:30303?discport=0")" ipc:/root/.ethereum/geth.ipc'
sudo docker exec bsc-geth-rpc sh -lc 'geth attach --exec "admin.addPeer(\"enode://7b3217465e0441753d5c2afcc2ce894acf7feb32a8dc218a4c677ec490bbea8f11b3eda42d514c195be2db9d7999da068deaba87ad7e307ba62b47d95052b216@127.0.0.1:30303\")" ipc:/root/.ethereum/geth.ipc'
sudo docker exec bsc-geth-rpc sh -lc 'geth attach --exec net.peerCount ipc:/root/.ethereum/geth.ipc'
sudo docker network inspect docker-compose_default
clear
ls
sudo docker exec bsc-geth-rpc sh -lc 'geth attach --exec admin.peers ipc:/root/.ethereum/geth.ipc'
sudo docker exec bsc-geth-miner sh -lc 'geth attach --exec "admin.nodeInfo.enode" ipc:/root/.ethereum/geth.ipc'
sudo docker exec bsc-geth-rpc sh -lc 'geth attach --exec "admin.addPeer(\"enode://7b3217465e0441753d5c2afcc2ce894acf7feb32a8dc218a4c677ec490bbea8f11b3eda42d514c195be2db9d7999da068deaba87ad7e307ba62b47d95052b216@127.0.0.1:30303?discport=0")" ipc:/root/.ethereum/geth.ipc'
ls
cd mychain/
sudo docker exec bsc-geth-rpc sh -lc 'geth attach --exec "admin.addPeer(\"enode://7b3217465e0441753d5c2afcc2ce894acf7feb32a8dc218a4c677ec490bbea8f11b3eda42d514c195be2db9d7999da068deaba87ad7e307ba62b47d95052b216@bsc-geth-miner:30303?discport=0\")" ipc:/root/.ethereum/geth.ipc'
sudo docker exec bsc-geth-rpc sh -lc 'geth attach --exec net.peerCount ipc:/root/.ethereum/geth.ipc'
sudo docker network ls
ls
cd mychain/
ls
cat geth.yml
history|grep connect
history | grep connect
sudo docker logs bsc-geth-rpc --tail=100
clear
sudo docker exec bsc-geth-rpc sh -lc 'geth attach --exec net.peerCount ipc:/root/.ethereum/geth.ipc'
sudo docker exec bsc-geth-miner sh -lc 'geth attach --exec "admin.nodeInfo.enode" ipc:/root/.ethereum/geth.ipc'
docker ps
sudo docker exec bsc-geth-miner sh -lc 'geth attach --exec "admin.nodeInfo.enode" ipc:/root/.ethereum/geth.ipc'
sudo docker exec bsc-geth-rpc sh -lc 'geth attach --exec "admin.addPeer(\"enode://7b3217465e0441753d5c2afcc2ce894acf7feb32a8dc218a4c677ec490bbea8f11b3eda42d514c195be2db9d7999da068deaba87ad7e307ba62b47d95052b216@127.0.0.1:30303?discport=0")" ipc:/root/.ethereum/geth.ipc'
sudo docker exec bsc-geth-miner sh -lc 'geth attach --exec "admin.nodeInfo.enode" ipc:/root/.ethereum/geth.ipc'
# 这样连接仍然有效
sudo docker exec bsc-geth-rpc sh -lc 'geth attach --exec "admin.addPeer(\"enode://...@bsc-geth-miner:30303?discport=0\")" ipc:/root/.ethereum/geth.ipc'
# 这样连接仍然有效
sudo docker exec bsc-geth-miner sh -lc 'geth attach --exec "admin.nodeInfo.enode" ipc:/root/.ethereum/geth.ipc'
sudo docker exec bsc-geth-rpc sh -lc 'geth attach --exec "admin.addPeer(\"enode://...@bsc-geth-miner:30303?discport=0\")" ipc:/root/.ethereum/geth.ipc'
sudo docker exec bsc-geth-rpc sh -lc 'geth attach --exec "admin.addPeer(\"enode://7b3217465e0441753d5c2afcc2ce894acf7feb32a8dc218a4c677ec490bbea8f11b3eda42d514c195be2db9d7999da068deaba87ad7e307ba62b47d95052b216@bsc-geth-miner:30303?discport=0\")" ipc:/root/.ethereum/geth.ipc'
sudo docker exec bsc-geth-rpc sh -lc 'geth attach --exec net.peerCount ipc:/root/.ethereum/geth.ipc'
sudo docker exec bsc-geth-miner sh -lc 'geth attach --exec "admin.nodeInfo.enode" ipc:/root/.ethereum/geth.ipc'
sudo docker exec bsc-geth-rpc sh -lc 'geth attach --exec "admin.addPeer(\"enode://7b3217465e0441753d5c2afcc2ce894acf7feb32a8dc218a4c677ec490bbea8f11b3eda42d514c195be2db9d7999da068deaba87ad7e307ba62b47d95052b216@bsc-geth-miner:30303?discport=0\")" ipc:/root/.ethereum/geth.ipc'
sudo docker exec bsc-geth-rpc sh -lc 'geth attach --exec "admin.addPeer(\"enode://7b3217465e0441753d5c2afcc2ce894acf7feb32a8dc218a4c677ec490bbea8f11b3eda42d514c195be2db9d7999da068deaba87ad7e307ba62b47d95052b216@bsc-geth-miner:30303\")" ipc:/root/.ethereum/geth.ipc'
sudo docker exec bsc-geth-rpc sh -lc 'geth attach --exec net.peerCount ipc:/root/.ethereum/geth.ipc'
cleear
clear
sudo ufw status
sudo docker exec bsc-geth-miner sh -lc 'geth attach --exec "admin.nodeInfo" ipc:/root/.ethereum/geth.ipc'
sudo docker exec bsc-geth-rpc sh -lc 'geth attach --exec "admin.nodeInfo" ipc:/root/.ethereum/geth.ipc'
sudo docker exec bsc-geth-rpc ping -c 3 bsc-geth-miner
sudo docker exec bsc-geth-rpc nc -zv bsc-geth-miner 30303
sudo docker exec bsc-geth-rpc sh -lc 'geth attach --exec "admin.addPeer(\"enode://7b3217465e0441753d5c2afcc2ce894acf7feb32a8dc218a4c677ec490bbea8f11b3eda42d514c195be2db9d7999da068deaba87ad7e307ba62b47d95052b216@bsc-geth-miner:30303?discport=0\")" ipc:/root/.ethereum/geth.ipc'
sudo docker exec bsc-geth-rpc sh -lc 'geth attach --exec "net.peerCount" ipc:/root/.ethereum/geth.ipc'
sudo docker exec bsc-geth-rpc sh -lc 'geth attach --exec "admin.addPeer(\"enode://7b3217465e0441753d5c2afcc2ce894acf7feb32a8dc218a4c677ec490bbea8f11b3eda42d514c195be2db9d7999da068deaba87ad7e307ba62b47d95052b216@172.18.0.3:30303?discport=0\")" ipc:/root/.ethereum/geth.ipc'
sudo docker exec bsc-geth-rpc sh -lc 'geth attach --exec net.peerCount ipc:/root/.ethereum/geth.ipc'
sudo docker exec bsc-geth-rpc sh -lc 'geth attach --exec "admin.addPeer(\"enode://7b3217465e0441753d5c2afcc2ce894acf7feb32a8dc218a4c677ec490bbea8f11b3eda42d514c195be2db9d7999da068deaba87ad7e307ba62b47d95052b216@bsc-geth-miner:30303\")" ipc:/root/.ethereum/geth.ipc'
sudo docker exec bsc-geth-rpc sh -lc 'geth attach --exec net.peerCount ipc:/root/.ethereum/geth.ipc'
sudo docker exec bsc-geth-rpc sh -lc 'geth attach --exec "admin.addPeer(\"enode://7b3217465e0441753d5c2afcc2ce894acf7feb32a8dc218a4c677ec490bbea8f11b3eda42d514c195be2db9d7999da068deaba87ad7e307ba62b47d95052b216@bsc-geth-miner:30303?discport=0\")" ipc:/root/.ethereum/geth.ipc'
sudo docker exec bsc-geth-rpc sh -lc 'geth attach --exec net.peerCount ipc:/root/.ethereum/geth.ipc'
sudo docker logs bsc-geth-miner --tail 50
sudo docker logs bsc-geth-rpc --tail 50
sudo docker inspect bsc-geth-miner | grep -A 10 "Networks"
sudo docker inspect bsc-geth-rpc | grep -A 10 "Networks"
sudo docker network connect mychain_default bsc-geth-rpc
sudo docker network disconnect mychain_default bsc-geth-rpc
sudo docker network disconnect docker-compose_default bsc-geth-rpc
sudo docker network connect mychain_default bsc-geth-rpc
sudo docker exec bsc-geth-rpc sh -lc 'geth attach --exec "admin.addPeer(\"enode://7b3217465e0441753d5c2afcc2ce894acf7feb32a8dc218a4c677ec490bbea8f11b3eda42d514c195be2db9d7999da068deaba87ad7e307ba62b47d95052b216@bsc-geth-miner:30303?discport=0\")" ipc:/root/.ethereum/geth.ipc'
sudo docker exec bsc-geth-rpc sh -lc 'geth attach --exec net.peerCount ipc:/root/.ethereum/geth.ipc'
sudo docker inspect bsc-geth-rpc | grep -A 20 "Networks"
sudo docker inspect bsc-geth-miner | grep -A 20 "Networks"
sudo docker exec bsc-geth-rpc sh -lc 'geth attach --exec "admin.addPeer(\"enode://7b3217465e0441753d5c2afcc2ce894acf7feb32a8dc218a4c677ec490bbea8f11b3eda42d514c195be2db9d7999da068deaba87ad7e307ba62b47d95052b216@172.18.0.3:30303?discport=0\")" ipc:/root/.ethereum/geth.ipc'
sudo docker exec bsc-geth-rpc sh -lc 'geth attach --exec "net.peerCount" ipc:/root/.ethereum/geth.ipc'
sudo docker inspect bsc-geth-rpc | grep -A 20 "Networks"
freemanbgk01@instance-20251025-012105:~$ sudo docker inspect bsc-geth-miner | grep -A 20 "Networks"
freemanbgk01@instance-20251025-012105:~$ sudo docker exec bsc-geth-rpc sh -lc 'geth attach --exec "admin.addPeer(\"enode://7b3217465e0441753d5c2afcc2ce894acf7feb32a8dc218a4c677ec490bbea8f11b3eda42d514c195be2db9d7999da068deaba87ad7e307ba62b47d95052b216@172.18.0.3:30303?discport=0\")" ipc:/root/.ethereum/geth.ipc'
true
freemanbgk01@instance-20251025-012105:~$ sudo docker exec bsc-geth-rpc sh -lc 'geth attach --exec "net.peerCount" ipc:/root/.ethereum/geth.ipc'
0
sudo docker logs bsc-geth-rpc --tail 100 | grep -i "peer\|connect\|error"
sudo docker exec bsc-geth-miner sh -lc 'geth attach --exec "admin.nodeInfo.enode" ipc:/root/.ethereum/geth.ipc'
sudo docker exec bsc-geth-rpc sh -lc 'geth attach --exec net.peerCount ipc:/root/.ethereum/geth.ipc'
sudo docker exec bsc-geth-rpc sh -lc 'geth attach --exec "admin.peers" ipc:/root/.ethereum/geth.ipc'
sudo docker exec bsc-geth-rpc sh -lc 'geth attach --exec "net.listening" ipc:/root/.ethereum/geth.ipc'
sudo docker exec bsc-geth-miner sh -lc 'geth attach --exec "net.listening" ipc:/root/.ethereum/geth.ipc'
sudo docker exec bsc-geth-miner netstat -tuln | grep 30303
sudo docker exec bsc-geth-rpc netstat -tuln | grep 30303
ls
cd mychain/
sudo bash run.sh 
sudo docker exec bsc-geth-miner netstat -tuln | grep 30303
sudo docker exec bsc-geth-rpc netstat -tuln | grep 30303
sudo docker exec bsc-geth-rpc sh -lc 'geth attach --exec "admin.addPeer(\"enode://7b3217465e0441753d5c2afcc2ce894acf7feb32a8dc218a4c677ec490bbea8f11b3eda42d514c195be2db9d7999da068deaba87ad7e307ba62b47d95052b216@bsc-geth-miner:30303?discport=0\")" ipc:/root/.ethereum/geth.ipc'
sudo docker exec bsc-geth-rpc sh -lc 'geth attach --exec net.peerCount ipc:/root/.ethereum/geth.ipc'
mkdir node
cd node
mkdir docker
mkdir abis
cd abis/
vim BscBridge.json
cd node
ls
vim abis/BscBridge.json
ls
mv 1.zip node/
cd node/
unzip 1.zip 
ls
rm -rf __MACOSX/
rm 1.zip 
ls
cd docker/
vim docker-compose.yml
vim my.cnf
docker compose up -d
ls
mkdir data
docker compose up -d
cd ..
ls
vim .env
vim package.json
npm install
node -v
screen -S usdt_replay
nvm
apt install nvm
sudo pat install nvm
sudo apt install nvm
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v
npm -v
screen -r usdt_replay 
ls
screen -r usdt_replay 
cd node/docker/
docker compose down
rm -rf data
ls
sudo rm -rf data
sudo docker compose up -d
ls
cd ..
screen -r usdt_replay 
ls
cd docker/
ls
docker compose -f down
docker compose down
sudo rm -rf data
mkdir data
docker compose up -d
docker ps
screen -r usdt_replay 
docker ps
ls
screen -r usdt_replay 
ls
cd node
cd docker
sudo docker compose down
screen -r usdt_replay 
ls
cd www/
ls
rm -rf ./*
mv ../yat.zip ./
unzip -r yat.zip 
unzip yat.zip 
ls
rm -r __MACOSX/
rm yat.zip 
ls
cd node
vim tokens.json
vim tokensApi.js
cd www/
ls
mv ../log.zip ./
unzip log.zip 
ls
rm -r __MACOSX/
rm log.zip 
cd ..
cd node/
mv ../tokensApi.js.zip ./
unzip tokensApi.js.zip 
rm tokensApi.js
unzip tokensApi.js.zip 
rm tokensApi.js.zip 
rm -r __MACOSX/
ls
cd www/
cp ../log.zip ./
unzip log
rm -rf log
unzip log.zip 
rm -r __MACOSX/
ls
ls
cd www/
ls
rm log.zip 
cd ../node/
curl -s https://repos.influxdata.com/influxdata-archive.key | sudo apt-key add -
echo "deb https://repos.influxdata.com/debian stable main" | sudo tee /etc/apt/sources.list.d/influxdata.list
sudo apt-get update
sudo apt-get install -y influxdb2
sudo systemctl enable influxdb
sudo systemctl start influxdb
sudo systemctl status influxdb
influx setup   --username admin   --password 'admincjnsbwicgao'   --org 'yat'   --bucket 'yat'   --retention 0   --token 'yatijbhoiqwncsaa'
ls
vim .env
ls
vim initDBB.js
screen -S tokensapi
clear
clear
ls
cd /etc/nginx/sites-enabled/
sudo vim yat-chain.com.conf 
history |grep nginx
sudo service nginx restart
sudo vim /etc/nginx/sites-enabled/yat-chain.com.conf 
sudo service nginx restart
ls
cd www/
mv ../dist.zip ./
ls
rm -r assets
rm index.html 
unzip dist.zip 
ls
rm -r __MACOSX/
ls
rm dist.zip 
ls
cd www/
mv ../dist.zip ./
rm -r assets/
rm index.html 
unzip dist.zip 
ls
rm -r __MACOSX/
rm dist.zip 
ls
rm log.zip 
cd 
cd www/
ls
rm -r log
rm -r assets/
rm index.html 
ls
mv ../dist.zip ./
unzip dist.zip 
ls
mv dist/* ./
ls
rm -r dist
rm -r __MACOSX/
rm dist.zip 
ls
cd node/
vim .env
vim swap_replayer.js
screen -ls
screen -S swap_replayer.js
screen -r swap_replayer.js 
ls
vim node/abis/Swap.json
screen -r swap_replayer.js 
ls
cd www/
ls
rm -r assets/
rm index.html 
mv ../dist.zip ./
unzip dist.zip 
ls
rm -r __MACOSX/
rm dist.zip 
ls
cd node/abis/
mv ../../Swap.json ./
cd ..
vim tokensApi.js 
ls
screen -r usdt_replay 
screen -r swap_replayer.js 
screen -r tokensapi 
screen -r tokensapi 
screen -r tokensapi 
screen -r swap_replayer.js 
screen -r swap_replayer.js 
screen -r tokensapi 
ls
cd node/
ls
screen -r swap_replayer.js 
scree -r tokensApi.js 
screen -r tokensApi.js 
screen -ls
ls
mv ../clearPinswapLogs.js ./
cd ..
screen -r tokensapi 
screen -r swap_replayer.js 
ls
cd www/
ls
rm index.html 
cd assets/
rm ./*.js
rm ./*.css
ls
cd ..
ls
cd ..
clear
ls
mkdir tmp
cd tmp/
mv ../dist.zip .
ls
unzip dist.zip 
ls
rm -r __MACOSX/
rm dist.zip 
mv index.html ../www/
cd assets/
mv ./*.js ../../www/assets/
mv ./*.css ../../www/assets/
ls
cd ..
ls
cd ..
rm -r tmp/
ls
cd mychain/
ls
cd ../blockscout/
ls
ls -a
ls
vim README.md
cd .
cd ..
ls
cd www/
ls
cd ..
ls
cd freemanbgk01/
