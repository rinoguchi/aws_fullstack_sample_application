import express from 'express';
import * as mariadb from 'mariadb';

// DB コネクションプールの初期化
const pool = mariadb.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    connectionLimit: 5
});

// express 初期化
const app = express();
app.use(express.json());
app.use(express.urlencoded({
    extended: true
}));
// ルーティングの定義
app.get('/comments/:id', async (req: express.Request, res: express.Response) => {
    console.log('get comment started.')
    let conn: mariadb.PoolConnection | undefined;
    try {
        conn = await pool.getConnection();
        const comment: Comment | null = await getComment(conn, Number(req.params.id));
        res.send(comment);
    } catch (err) {
        throw err;
    } finally {
        if (conn) conn.release();
    }
})
app.post('/comments', async (req: express.Request, res: express.Response) => {
    console.log('post comment started.')
    let conn: mariadb.PoolConnection | undefined;
    try {
        conn = await pool.getConnection();
        const id: number = await insertComment(conn, req.body.comment);
        const comment: Comment | null = await getComment(conn, id);
        res.send(comment);
    } catch (err) {
        throw err;
    } finally {
        if (conn) conn.release();
    }
})
app.listen(3000);

// モデル定義
type Comment = {
    id: number;
    comment: string;
}

// DB アクセス
const getComment = async (conn: mariadb.PoolConnection, id: number): Promise<Comment | null> => {
    const res: Array<Comment> = await conn.query("select * from comments where id = ?", [id]);
    if (res.length === 0) return null
    return res[0];
}
const insertComment = async (conn: mariadb.PoolConnection, comment: string): Promise<number> => {
    const res = await conn.query("insert into comments(comment) value (?)", [comment]);
    const id = res.insertId;
    return id;
}