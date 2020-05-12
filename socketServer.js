"use strict";
// Optional. You will see this name in eg. 'ps' or 'top' command
process.title = 'torrent_download_request_interface';
const fs = require('fs')
// Port where we'll run the websocket server
var webSocketsServerPort = 1337;
// websocket and http servers
var webSocketServer = require('websocket').server;
var http = require('http');


const doesFileExists = (path) => {
    var fileExists = false;
    console.log('about to check existance of ' + path);
    try {
        if (fs.existsSync(path)) {
            console.log("The file exists.");
            fileExists = true;
        } else {
            console.log('The file does not exist.');
        }
    } catch (err) {
        console.error(err);
    }
    return  fileExists;
}
/**
 * Global variables
 */
// latest 100 messages
//var history = [ ];
// list of currently connected clients (users)
var clients = [ ];
/**
 * Helper function for escaping input strings
 */
function htmlEntities(str) {
  return String(str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
// Array with some colors
//var colors = [ 'red', 'green', 'blue', 'magenta', 'purple', 'plum', 'orange' ];
// ... in random order
//colors.sort(function(a,b) { return Math.random() > 0.5; } );
/**
 * HTTP server
 */
var server = http.createServer(function(request, response) {
  // Not important for us. We're writing WebSocket server,
  // not HTTP server
});
server.listen(webSocketsServerPort, function() {
  console.log((new Date()) + " Server is listening on port "
      + webSocketsServerPort);
});
/**
 * WebSocket server
 */
var wsServer = new webSocketServer({
  // WebSocket server is tied to a HTTP server. WebSocket
  // request is just an enhanced HTTP request. For more info 
  // http://tools.ietf.org/html/rfc6455#page-6
  httpServer: server
});
// This callback function is called every time someone
// tries to connect to the WebSocket server
wsServer.on('request', function(request) {
  console.log((new Date()) + ' Connection from origin '
      + request.origin + ' .');
  // accept connection - you should check 'request.origin' to
  // make sure that client is connecting from your website
  // (http://en.wikipedia.org/wiki/Same_origin_policy)
  var connection = request.accept(null, request.origin); 
  // we need to know client index to remove them on 'close' event
  var index = clients.push(connection) - 1;
  console.log((new Date()) + ' Connection accepted.');
  // send back chat history
  //if (history.length > 0) {
  //  connection.sendUTF(
  //      JSON.stringify({ type: 'history', data: history} ));
  //}
  // user sent some message
  connection.on('message', function(message) {
    if (message.type === 'utf8') { // accept only text
        console.log((new Date()) + ' Received Message from '
                    + ': ' + message.utf8Data);
        


            var hash = htmlEntities(message.utf8Data)
            var WebTorrent = require('webtorrent-hybrid')

            var client = new WebTorrent()
                
            var magnetURI = 'https://yts.mx/torrent/download/' + hash;


            var filePath = '/var/www/files/' + hash;

            var fileExists = doesFileExists(filePath + '/done.txt');

            var called = false;
            client.add(magnetURI, { path: filePath }, function (torrent) {
                var file = torrent.files.find(function (file) {
                    return file.name.endsWith('.mp4')
                })
        
                torrent.on('done', function () {
                    clearInterval()
                    var file = torrent.files.find(function (file) {
                        return file.name.endsWith('.mp4')
                    })
                    fs.writeFile(filePath + "/done.txt", "completed", (err) => {
                        if (err) console.log(err);
                    });
                    console.log('torrent download finished done file writen to ' + filePath + "/done.txt")

                    // broadcast message to the client that asked for this file
                    // TODO use a method so you don't repeat this logic all over the place
                    var json = {
                        type: 'progress',
                        hash: hash,
                        value: (torrent.progress * 100).toFixed(1),
                        videoStreamUrlOriginal: '/movie?hash='+hash

                    }
                    var json = JSON.stringify(json);
                    clients[index].sendUTF(json);

                    torrent.destroy((error) => {
                        
                        console.log('Torrent destroyed : error ? '+error);
                        client.destroy((error) => {
                            console.log('client destroyed : error ? '+error);
                        })
                        
                    })

                })
        
                setInterval(onProgress, 1000)
        
                function onProgress() {
                    console.log('progress = ' + (torrent.progress * 100).toFixed(1))
                    var file = torrent.files.find(function (file) {
                        return file.name.endsWith('.mp4')
                    })
                    var videoPath = '/var/www' + '/files/' + hash + '/' + file.path;
                    
                    
                    // broadcast message to the client that asked for this file
                    var json = {
                        type: 'progress',
                        hash: hash,
                        value: (torrent.progress * 100).toFixed(1),
                        videoStreamUrlOriginal: '/movie?hash='+hash

                    }
                    var json = JSON.stringify(json);
                    clients[index].sendUTF(json);
                    
                    if (torrent.progress > 0.03 && !called) {
                        var file = torrent.files.find(function (file) {
                            return file.name.endsWith('.mp4')
                        })
                        fs.writeFile(filePath + "/mediaFileSize.txt", file.length, (err) => {
                            if (err) console.log(err);
                        });
                        fs.writeFile(filePath + "/mediaPath.txt", '/var/www' + '/files/' + hash + '/' + file.path, (err) => {
                            if (err) console.log(err);
                        });
                        console.log('http://flixjsmovies.books2borrow.tk/' + hash + '/' + file.path);
                        called = true;
                    }

                }
            })





      }
    
  });
  // user disconnected
  connection.on('close', function(connection) {

    // do something on connection closed ?
  });
});