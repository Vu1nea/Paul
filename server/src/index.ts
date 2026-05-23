import express, { Request, Response } from 'express';

const app = express();

app.get('/health', (req: Request, res: Response) => {
    res.json({ status: 'ok' })
})

app.get('/', (req: Request, res: Response) => {
    res.json({ body: 'hello world' })
})

app.listen(3001, () => console.log('Server running on port 3001: http://localhost:3001'))
