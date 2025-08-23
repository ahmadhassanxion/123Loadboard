# LowCreditLoanBot - Loan Data Processing and Web Scraping Tool

## Overview
LowCreditLoanBot is a Node.js application designed to process loan-related data from Excel files and perform web scraping tasks. The tool is built with Puppeteer for browser automation and includes features for handling proxy rotation and data processing.

## Features
- Process Excel files containing loan data
- Format and normalize personal information
- Web scraping with rotating proxies to avoid detection
- Batch processing of records
- Error handling and retry mechanisms

## Prerequisites
- Node.js (v14 or higher recommended)
- npm (comes with Node.js)

## Installation
1. Clone the repository or download the source code
2. Navigate to the project directory
3. Install dependencies:
   ```
   npm install
   ```

## Configuration
1. Place your input Excel file as `data.xlsx` in the root directory
2. Add proxies to `proxies.txt` (one proxy per line)

## Usage
1. Run the application:
   ```
   node index.js
   ```
   Or use the batch file:
   ```
   run.bat
   ```

## File Structure
- `index.js` - Main application file
- `dataFormat.js` - Data processing and formatting utilities
- `data.xlsx` - Input Excel file (user-provided)
- `processed_data.json` - Output file with processed data
- `proxies.txt` - List of proxy servers
- `run.bat` - Batch file to run the application

## Data Format
The application processes data into the following JSON structure:
```json
{
  "personalInfo": {
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com",
    "phone": "123-456-7890",
    "dob": "1980-01-01",
    "ssnLast4": "1234",
    "driverLicense": "DL12345678",
    "driverLicenseState": "CA",
    "military": false,
    "usCitizen": true
  },
  "address": {
    "street": "123 Main St",
    "city": "Anytown",
    "state": "CA",
    "zip": "12345",
    "yearsAtAddress": 5
  }
}
```

## Dependencies
- puppeteer: ^24.14.0
- puppeteer-extra: ^3.3.6
- puppeteer-extra-plugin-stealth: ^2.11.2
- xlsx: ^0.18.5

## Notes
- Ensure you have the necessary permissions to scrape target websites
- Be aware of and comply with website terms of service
- Handle sensitive data with care and in compliance with relevant privacy laws

## License
[Specify your license here]
