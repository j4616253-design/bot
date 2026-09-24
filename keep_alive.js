const express = require('express');
const app = express();
const port = process.env.PORT || 10000;

app.get('/', (req, res) => {
  res.send('Bot Ecosystem Online!');
});

app.listen(port, '0.0.0.0', () => {
  console.log(`📡 Port detected! Keep-alive server successfully bound to port ${port}`);
});
