import { config as dotenvConfig } from "dotenv";
import mysql from "mysql2/promise";

dotenvConfig({ path: '.env' });

// MySQL 连接池配置
const dbConfig = {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 1,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
};

async function clearPinswapLogs() {
    let connection;
    try {
        console.log("📡 正在连接 MySQL 数据库...");
        connection = await mysql.createConnection(dbConfig);
        console.log("✅ MySQL 数据库连接成功");

        // 获取当前记录数
        const [countRows] = await connection.execute('SELECT COUNT(*) as count FROM pinswap_logs');
        const recordCount = countRows[0].count;
        console.log(`📊 当前 pinswap_logs 表中有 ${recordCount} 条记录`);

        if (recordCount === 0) {
            console.log("ℹ️  表已经是空的，无需清空");
            return;
        }

        // 清空表数据
        console.log("🗑️  正在清空 pinswap_logs 表...");
        await connection.execute('TRUNCATE TABLE pinswap_logs');
        console.log("✅ pinswap_logs 表已清空");

        // 验证清空结果
        const [verifyRows] = await connection.execute('SELECT COUNT(*) as count FROM pinswap_logs');
        const remainingCount = verifyRows[0].count;
        console.log(`✅ 验证完成，剩余记录数: ${remainingCount}`);

    } catch (err) {
        console.error("❌ 清空数据表失败:", err.message);
        process.exit(1);
    } finally {
        if (connection) {
            await connection.end();
            console.log("🔌 数据库连接已关闭");
        }
    }
}

// 执行清空操作
clearPinswapLogs()
    .then(() => {
        console.log("🎉 脚本执行完成");
        process.exit(0);
    })
    .catch((err) => {
        console.error("❌ 脚本执行失败:", err.message);
        process.exit(1);
    });

