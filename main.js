import express from "express";
import fs from "fs";
import run from "./test.js";
const app = express();

app.get("/", (req, res) => {
    res.send("Hello World!");
});
app.get("/xeno/:location", async (req, res) => {
    try {
        console.log(`Starting search for location: ${req.params.location}`);
        const filename = await run(req.params.location);
        
        // Read the file and send its contents
        fs.readFile(filename, 'utf8', (err, data) => {
            if (err) {
                console.error('Error reading file:', err);
                return res.status(500).send({ 
                    success: false, 
                    error: 'Error reading the result file',
                    details: err.message 
                });
            }
            try {
                const jsonData = JSON.parse(data);
                res.send({ 
                    success: true, 
                    filename: filename,
                    data: jsonData 
                });
            } catch (parseError) {
                console.error('Error parsing JSON:', parseError);
                res.status(500).send({ 
                    success: false, 
                    error: 'Error parsing the result file',
                    details: parseError.message 
                });
            }
        });
    } catch (error) {
        console.error('Error in /xeno/:location:', error);
        res.status(500).send({ 
            success: false, 
            error: error.message || 'An unknown error occurred',
            stack: process.env.NODE_ENV === 'production' ? undefined : error.stack
        });
    }
});

app.listen(9000, () => {
    console.log("Server started on port 9000");
});

