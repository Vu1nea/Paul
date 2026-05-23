const express = require('express');

const app = express();

app.get('/health', (req, res) => {
    res.json({ status: 'ok' })
})

app.get('/', (req, res) => {
    res.json({ body: 'hello world', nipun: 'bum' })
})

app.listen(3001, () => console.log('Server running on port 3001'))
