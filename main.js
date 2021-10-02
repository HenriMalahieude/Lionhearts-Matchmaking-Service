//Library Importation
require('dotenv').config();
const http = require('http');
const url = require('url');

//Endpoints
const updateQueue = require('./Endpoints/updateQueue.js');
const getMatchInfo = require('./Endpoints/getMatchInfo.js');

//Private Modules
const matchmakerClass = require('./Matchmaker.js');
const LiveMatchmaker = new matchmakerClass('Live');
const TestMatchmaker = new matchmakerClass('Test');

//Note: Users in the MatchMaker array are required to have a 'MatchSize' and 'MapId' parameter, if = 0 then that means they are quick play. 'MatchSize' and 'MapId' cannot = undefined.
setInterval(function(){
    LiveMatchmaker.processQueue();
}, 15000)

setInterval(function(){
    TestMatchmaker.processQueue();
}, 5000)

/* 
    Format for Messages:
    {
        Header: {
            . . . 
            . . .
            x_api_key = key,
            environment: live, or test
        },
        Method: 'POST' (or PUT)
        Body: {
        }
    }
*/

const httpServer = http.createServer((req, res) => {
    //console.log('Recieved a message to Server from ' + req.headers['user-agent'])
    function failMessage(code){
        if (code != 401){
            console.warn('Sending ' + code + ' to ' + req.headers['user-agent'])
        }
        res.writeHead(code);
        res.end();
    }
    function figureSuccess(jsonSend){
        if (jsonSend != undefined){
            res.writeHead(200, {
                'Content-Length': Buffer.byteLength(jsonSend),
                'Content-Type': 'application/json'
            })
            res.end(jsonSend);
        }else{
            console.warn('Seems there was an error getting proper JSON')
            failMessage(500);
        }
    }

    const {headers, method} = req;
    //console.log(headers)
    const address = url.parse(req.url, true);
    if (headers['x-api-key'] == process.env.X_API_KEY){ //ensure api key and only an authorized user can access
        let body = '';
        req.on('error', err => {
            console.warn('Http Request errored: '  + err)
        }).on('data', chunk => {
            body += chunk //If the packets come out of order, idk how it's handled by the system. I think it works...
        }).on('end', () =>{
            if (method == 'POST' || method == 'PUT'){ //All POST requests
                let processedBody;
                try{
                    processedBody = JSON.parse(body);
                }catch{
                    console.warn('Invalid JSON Recieved!')
                    failMessage(400);
                }finally{
                    if (processedBody){
                        let endpoint = address.pathname.replace('/', '').replace('.', '')
                        if (endpoint == 'updateQueue'){
                            if (headers['environment'] && headers['environment'] == 'live'){
                                figureSuccess(updateQueue.fire(processedBody, LiveMatchmaker));
                            }else{
                                figureSuccess(updateQueue.fire(processedBody, TestMatchmaker));
                            }
                        }else{
                            failMessage(404);
                        }
                    }
                }
            }else if (method == 'GET'){ //All get requests
                let endpoint = address.pathname.replace('/', '').replace('.', '')
                if (endpoint == 'getMatchInfo'){
                    if (headers['environment'] && headers['environment'] == 'live'){
                        figureSuccess(getMatchInfo.fire(address.query, LiveMatchmaker));
                    }else{
                        figureSuccess(getMatchInfo.fire(address.query, TestMatchmaker));
                    }
                }else{
                    failMessage(404);
                }

            }else{
                failMessage(404);
            }
        })
    }else{
        failMessage(401);
    }
})

    

httpServer.listen(process.env.HTTP_PORT, `${process.env.HTTP_HOST}`, () => {
    console.log('Server is open and listening to activity on port ' + process.env.HTTP_PORT)
})