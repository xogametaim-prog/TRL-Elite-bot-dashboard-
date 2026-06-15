const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Bot is online and running 24/7!');
});

function keepAlive() {
    app.listen(PORT, () => {
        console.log(`Web server listening on port ${PORT}`);
    });
}

module.exports = keepAlive;