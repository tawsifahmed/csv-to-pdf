const express = require('express')
const { parse } = require('csv-parse')
const fs = require('fs')
const pug = require('pug')
const puppeteer = require('puppeteer')
const XLSX = require('xlsx');
const app = express()
const csvs = require('./data')

function generatePdfs(genderProps, lengthProps, areaProps, fileNameProps) {

    let gender = genderProps /// input value when send csv
    const length = lengthProps /// input value when send csv
    let area = areaProps /// input value when send csv
    let fileName = fileNameProps

    let voteCenter = ''
    let areaNumber = ''
    let areaName = ''
    let union = ''
    let word = ''

    gender === 'female' ? gender = 'ম' : gender = 'প'

    const parseExcel = (filename) => {
        const excelData = XLSX.readFile(filename);

        return Object.keys(excelData.Sheets).map(name => ({
            name,
            data: XLSX.utils.sheet_to_json(excelData.Sheets[name]),
        }));
    };

    var exlData = []
    parseExcel('./center.xlsx').forEach(element => {
        exlData = element.data
    });

    function convertToBanglaString(input) {
        const digitMap = {
            '0': '০',
            '1': '১',
            '2': '২',
            '3': '৩',
            '4': '৪',
            '5': '৫',
            '6': '৬',
            '7': '৭',
            '8': '৮',
            '9': '৯'
        };

        // Replace each digit with its Bangla counterpart
        const banglaString = input.replace(/\d/g, digit => digitMap[digit]);

        return banglaString;
    }

    function convertBengaliToArabic(bengaliNumber) {
        const digitMap = {
            '০': '0',
            '১': '1',
            '২': '2',
            '৩': '3',
            '৪': '4',
            '৫': '5',
            '৬': '6',
            '৭': '7',
            '৮': '8',
            '৯': '9'
        };

        // Replace each Bengali numeral with its Arabic counterpart
        const arabicNumber = bengaliNumber.replace(/[০-৯]/g, digit => digitMap[digit]);

        return arabicNumber;
    }

    exlData.forEach((item) => {
        let engArea = convertBengaliToArabic(item['ভোটার এলাকার নম্বর'])

        // console.log('test =>', area === Number(engArea) && gender === item['প/ম'])

        if (area === Number(engArea) && gender === item['প/ম']) {
            const vC = convertToBanglaString(`${item['ক্রমিক নং']}`)
            const w = convertToBanglaString(`${item['ওয়ার্ড ']}`)

            voteCenter = ` ${vC} - ${item['কেন্দ্রের নাম']}`
            areaNumber = item['ভোটার এলাকার নম্বর']
            areaName = item['ভোটার এলাকা']
            union = item['পৌরসভা / ইউনিয়ন']
            word = w
        }
    })

    const obj = {
        'voteCenter': voteCenter,
        'areaNumber': areaNumber,
        'areaName': areaName,
        'union': union,
        'word': word
    }

    console.log('obj =>', obj)

    const parserOne = parse({ columns: true }, function (err, records) {

        const newArray = []

        for (let i = 0; i < records.length; i++) {
            let banglaString = convertToBanglaString(records[i]['Serial Number']);
            if (banglaString.length < length) {
                console.log('error =>', records[i]['Serial Number'])
                let str1 = records[i - 1]['Serial Number'];
                let str2 = "৩";

                let num1 = Number(str1.replace(/[০১২৩৪৫৬৭৮৯]/g, function (match) {
                    return match.charCodeAt(0) - '০'.charCodeAt(0);
                }));

                let num2 = Number(str2.replace(/[০১২৩৪৫৬৭৮৯]/g, function (match) {
                    return match.charCodeAt(0) - '০'.charCodeAt(0);
                }));

                let sum = num1 + num2;

                let result = ('০'.repeat(str1.length - String(sum).length)) + String(sum).replace(/\d/g, function (match) {
                    return String.fromCharCode(parseInt(match) + '০'.charCodeAt(0));
                });

                records[i]['Serial Number'] = result
                records[i]['Serial Number'] = convertToBanglaString(records[i]['Serial Number'])
                records[i]['Voter No'] = convertToBanglaString(records[i]['Voter No'])

                newArray.push({ ...records[i], ...obj })
            } else {
                records[i]['Serial Number'] = convertToBanglaString(records[i]['Serial Number'])
                records[i]['Voter No'] = convertToBanglaString(records[i]['Voter No'])
                newArray.push({ ...records[i], ...obj })
            }
        }

        // console.log('newArray =>', newArray)

        const sortedArray = newArray.sort((a, b) => a['Serial Number'].localeCompare(b['Serial Number'], 'bn', { numeric: true }));

        // console.log('sortedArray =>', sortedArray);



        const total = sortedArray.slice(0, sortedArray.length)
        console.log('total =>', total.length)

        function roundToNearestFive(number) {
            // Get the last digit
            const lastDigit = number % 10;

            if (lastDigit === 0 || lastDigit === 5) {
                return number; // No change needed
            }

            // Calculate the difference needed to round to the nearest 5
            difference = lastDigit < 5 ? 5 - lastDigit : 10 - lastDigit;

            // Round the number to the nearest 5
            const roundedNumber = number + difference;

            return roundedNumber;
        }

        function rearrangeData(data, rows, columns) {
            const result = [];

            for (let i = 0; i < data.length; i++) {
                const colIndex = i % columns;
                const rowIndex = Math.floor(i / columns);
                const newIndex = colIndex * rows + rowIndex;
                result[newIndex] = { ...data[i] };
            }

            return result;
        }

        let difference = 0
        const roundedNumber = roundToNearestFive(total.length)

        let arrayOfObjects = Array(difference).fill({
            'Serial Number': '',
            Name: '',
            'Voter No': '',
            Father: '',
            Mother: '',
            Occupation: '',
            DOB: '',
            Address: ''
        });
        // console.log('roundedNumber =>', roundedNumber)

        const inputData = roundedNumber;
        const rows = 5;
        const columns = roundedNumber / 5;

        const inputDataArray = [...total, ...arrayOfObjects]

        const result = rearrangeData(inputDataArray, rows, columns);
        console.log('result =>', result.length)

        const htmlContent = generateHTML(result, 'Male');
        createPDF(htmlContent, `${fileName}.pdf`);
    })
    // const parserTwo = parse({columns: true}, function(err, records){
    //     const htmlContent = generateHTML(records, 'Female');
    //     createPDF(htmlContent, 'parsed_output_female.pdf');
    // })

    function generateHTML(records, gender) {
        // Use pug template to generate HTML
        const compiledFunction = pug.compileFile('test.pug');
        const htmlContent = compiledFunction({ records, gender });
        return htmlContent;
    }

    async function createPDF(htmlContent, outputFileName) {
        const itemHeight = 1; // Adjust the height based on your content
        const startY = 1; // Adjust the starting Y position based on your layout

        const yPosition = startY + 5 * itemHeight;

        const browser = await puppeteer.launch();
        const page = await browser.newPage();


        await page.setContent(htmlContent);

        // You can customize the PDF options as needed
        await page.pdf({ path: outputFileName, format: 'A4', timeout: 0 });

        await browser.close();
    }

    fs.createReadStream(__dirname + `/female_csvs/${fileName}.csv`).pipe(parserOne)
    // fs.createReadStream(__dirname+'/parsed_output_female.csv').pipe(parserTwo)

}

// console.log('csvs length =>', csvs.length)
// csvs.slice(289, 296).forEach((element) => {
//     const gender = element.gender /// input value when send csv
//     const length = element.length /// input value when send csv
//     const area = element.area /// input value when send csv
//     const fileName = element.fileName /// input value when send csv
//     generatePdfs(gender, length, area, fileName)
// });


const gender = 'female' /// input value when send csv
const length = 4  /// input value when send csv
const area = 1556 /// input value when send csv
const fileName = '671556_com_1395_female_without_photo_78_2023-10-1' /// input value when send csv
generatePdfs(gender, length, area, fileName)

app.use(express.json())
app.listen(3000, () => console.log('Server started'))