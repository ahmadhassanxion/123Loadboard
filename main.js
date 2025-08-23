import express from "express";
import run from "./test.js";
const app = express();

app.get("/", (req, res) => {
    res.send("Hello World!");
});
app.get("/xeno/:location", async (req, res) => {
    try {
        const filename = await run(req.params.location);
        res.send({ success: true, filename });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send({ success: false, error: error.message });
    }
});

app.listen(9000, () => {
    console.log("Server started on port 9000");
});

