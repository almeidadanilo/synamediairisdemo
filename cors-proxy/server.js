const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());

app.get('/proxy', (req, res) => {
  const targetUrl = req.query.url;
  if (!targetUrl) {
    return res.status(400).send('URL is required');
  }

  axios.get(targetUrl)
    .then(response => res.send(response.data))
    .catch(error => res.status(500).send(error.toString()));
});

app.listen(8080, () => {
  console.log('CORS Proxy server running on port 8080');
});
