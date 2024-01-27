
const { spawn } = require('child_process');
const axios = require('axios');
const fs = require('fs');
const aws = require("aws-sdk")

const uploader = require("./upload").manageUploadST;

const xvfb = spawn('Xvfb', [':99', '-screen', '0', '1280x1024x24', '-ac', '+extension', 'GLX', '+render', '-noreset']);

xvfb.stdout.on('data', (data) => {
    console.log(`stdout: ${data}`);
});

xvfb.stderr.on('data', (data) => {
    console.log(`stderr: ${data}`);
});

const puppeteer = require('puppeteer-extra')
// add stealth plugin and use defaults (all evasion techniques)
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
puppeteer.use(StealthPlugin())



function getProfileLink(name){
    return new Promise(async (resolve,reject)=>{

        try{
        const url = "https://socialblade.com/youtube/channel/@"+name;

        const browser =  await puppeteer.launch({
            headless:true,
            // executablePath: '/usr/bin/google-chrome',
            args:[
                '--no-sandbox',
                "--incognito", "--start-maximized"
            ]
        });
    
        const page = await browser.newPage()
        await page.setRequestInterception(true);
    
        page.on('request', function(req){
    
            if(req.resourceType() == 'sklmcript'){
                req.abort();
            }else{
    
            req.continue()
            }
            console.log(req.resourceType())
        });
    
        
        await page.goto(url,{
            waitUntil: "networkidle2"
        })
        
    
        await page.waitForSelector("#YouTubeUserTopInfoAvatar");

        const link = await page.evaluate(()=>{
    
           return  document.getElementById("YouTubeUserTopInfoAvatar").src
        })

        await browser.close()
    
        resolve(link)
    }catch(err){
        reject(err)
    }

    })
}


function downloadFile(link, filename) {
    return new Promise((resolve, reject) => {
        axios({
            method: 'get',
            url: link,
            responseType: 'stream',
        })
        .then(response => {
            const writer = fs.createWriteStream(filename);
            response.data.pipe(writer);

            writer.on('finish', () => {
                writer.close();
                resolve();
            });

            writer.on('error', (err) => {
                reject(err);
            });
        })
        .catch(error => {
            reject(error);
        });
    });
}

const channel = process.env.channel;
const  callbackurl = process.env.callback;

if(!channel) {
    console.log("no channel")
    process.exit(1);
    return;
}

if(!callbackurl){
    console.log("no callback")
    process.exit(1);
    return;
}


(()=>{
    console.log("running...:")
    setTimeout(()=>{
        console.log("boom")
        getProfileLink(channel).then(async (link)=>{
            console.log(link);


            await downloadFile(link, "image.jpeg")

            const params = {
                Bucket: "griffin-record-input",
                Key: `${channel}.jpeg`,
                Body: fs.createReadStream("image.jpeg"),
                ContentType: "images/jpeg"
            }

           const loci=  await uploader(params, 'eu-west-1')

          await  axios.post(callbackurl,{
            url:loci,
            channel: channel
           })




            process.exit(0);
        }).catch((err)=>{
            console.log(err)
            process.exit(1);
        })
    },5000)
})()