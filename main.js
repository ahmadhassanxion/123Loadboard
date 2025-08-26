import express from "express";
import fs from "fs";
import run from "./testNew.js";
const app = express();

app.get("/", (req, res) => {
    res.send("Hello World!");
});
app.get("/xeno/:location", async (req, res) => {
    try {
        console.log(`Starting search for location: ${req.params.location}`);
        const result = await run(req.params.location);
        
        // if (!result) {
        //     return res.status(404).json({
        //         success: false,
        //         message: 'No data was captured for the specified location',
        //         data: result
        //     });
        // }

        console.log(`Search completed for location: ${req.params.location}`);
        console.log(`Filename: ${req.params.location}.json`);
        
        // Send the response with the file data
        res.json({
            success: true,
            filename: `${req.params.location}.json`,
            // data: resul
        });
       
    } catch (error) {
        console.error('Error in /xeno/:location:', error);
        res.status(500).json({ 
            success: false, 
            error: error.message || 'An unknown error occurred',
            stack: process.env.NODE_ENV === 'production' ? undefined : error.stack
        });
    }
});

app.listen(9000, () => {
    console.log("Server started on port 9000");
});

