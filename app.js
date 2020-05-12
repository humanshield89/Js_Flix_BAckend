const express = require('express')
const app = express()
const fs = require('fs')
const path = require('path')

var cors = require('cors');

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

const streamVideo =  (hash , req , res) => {
    console.log('requested original quality')
    console.log("range was provided ?" + req.headers.range);
    //let mediaPath = fs.readFileSync('/var/www' + '/files/' + req.query.hash + '/mediaPath.txt');
    let path = '/var/www' + '/files/' + hash + '/sd.mkv';
    console.log('path = ' + path);
    console.log('path = ' + path);
    let stat = fs.statSync(path)
    let fileSize = stat.size
    //fileSize = fs.readFileSync('/var/www' + '/files/' + req.query.hash + '/mediaFileSize.txt')
    const range = req.headers.range ? req.headers.range : "bytes=0-"; /**+ fileSize // TODO dynamic size maybe */
    if (range) {
        const parts = range.replace(/bytes=/, "").split("-")
        const start = parseInt(parts[0], 10)
        const end = parts[1]
            ? parseInt(parts[1], 10)
            : fileSize - 1
        const chunksize = (end - start) + 1
        const file = fs.createReadStream(path, { start, end })


        const head = {
            'Content-Range': `bytes ${start}-${end}/*`/**${fileSize}*/,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize,
            'Content-Type': 'video/mp4'
        }
        if(!doesFileExists('/var/www' + '/files/' + hash + '/converted')){
            head['X-Content-Duration'] = 14000;
            head['Content-Duration'] = 14400;
        }
        res.writeHead(206, head);
        file.pipe(res);
    } else {
        const head = {
            'Content-Range': `bytes ${start}-${end}/*`,
            'Content-Length': fileSize,
            'Accept-Ranges': 'bytes',
            'Content-Type': 'video/mp4',
        }
        res.writeHead(200, head)
        //fs.createReadStream(path).pipe(res)
    }
}

app.use(cors());

app.get('/', function (req, res) {

    if (!req.query.hash) {
        res.send('<div style="text-align: center;"><h2>These aren\'t the arguments we are looking for<h2>' +
            "<img src='https://media.giphy.com/media/3o84sF21zQYacFcl68/giphy.gif'></img></div>");
        res.end()
        return;
    }

    var filePath = '/var/www/files/' + req.query.hash;

    var fileExists = doesFileExists(filePath + '/done.txt');


    /** TODO maybe we need to start the torrent to seed to RTC clients 
    if(fileExists){
        res.send('/movie/?hash='+req.query.hash+'/&fileName='+req.query.hash+'.mp4');
        res.end();
        return;
    }
    */
    console.log('received a request on port 3001')
    var called = false;
    //res.send('you sent this hash'+req.query.hash)

    var WebTorrent = require('webtorrent')

    var client = new WebTorrent()

    var magnetURI = 'https://yts.mx/torrent/download/' + req.query.hash



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

            torrent.destroy((error) => {
                        
                console.log('Torrent destroyed : error ? '+error);
                client.destroy((error) => {
                    console.log('client destroyed : error ? '+error);
                })
                
            })

        })

        setInterval(onProgress, 2000)

        function onProgress() {
            if(!torrent) return;
            console.log('progress = ' + (torrent.progress * 100).toFixed(1))
            var file = torrent.files.find(function (file) {
                return file.name.endsWith('.mp4')
            })

            var videoPath = '/var/www' + '/files/' + req.query.hash + '/' + file.path;
            if (torrent.progress > 0.03 && !called) {
                var file = torrent.files.find(function (file) {
                    return file.name.endsWith('.mp4')
                })
                fs.writeFile(filePath + "/mediaFileSize.txt", file.length, (err) => {
                    if (err) console.log(err);
                });
                fs.writeFile(filePath + "/mediaPath.txt", '/var/www' + '/files/' + req.query.hash + '/' + file.path, (err) => {
                    if (err) console.log(err);
                });
                //res.send('http://flixjsmovies.books2borrow.tk/'+req.query.hash+'/'+file.path);
                res.send('/movie/?hash=' + req.query.hash + '/&fileName=' + file.name);
                console.log('http://flixjsmovies.books2borrow.tk/' + req.query.hash + '/' + file.path);
                called = true;
            }

        }
    })


})
app.get('/movie', function (req, res) {
    // hash wasn't provided
    if (!req.query.hash) {
        res.statusCode = 400;
        res.send('<div style="text-align: center;"><h2>These aren\'t the arguments we are looking for<h2>' +
            "<img src='https://media.giphy.com/media/3o84sF21zQYacFcl68/giphy.gif'></img></div>");
        res.end()
        return;
    }
    // file was never downloaded or invalid hash 
    if(!doesFileExists('/var/www' + '/files/' + req.query.hash + '/mediaPath.txt')) {
        res.statusCode = 404;
        res.end();
        return;
    }
    // default the quality to original ,change it if user requested it
    const quality = req.query.quality ? req.query.quality : 0;
    if (quality == 0) {
        // original quality no conversion
        console.log('requested original quality')
        console.log("range was provided ?" + req.headers.range);
        let mediaPath = fs.readFileSync('/var/www' + '/files/' + req.query.hash + '/mediaPath.txt');
        let path = mediaPath;
        console.log('path = ' + path);
        console.log('path = ' + mediaPath);
        let stat = fs.statSync(path)
        let fileSize = stat.size
        fileSize = fs.readFileSync('/var/www' + '/files/' + req.query.hash + '/mediaFileSize.txt')
        const range = req.headers.range ? req.headers.range : "bytes=0-" /**+ fileSize*/
        if (range) {
            const parts = range.replace(/bytes=/, "").split("-")
            const start = parseInt(parts[0], 10)
            const end = parts[1]
                ? parseInt(parts[1], 10)
                : fileSize - 1
            const chunksize = (end - start) + 1
            const file = fs.createReadStream(path, { start, end })


            const head = {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize,
                'Content-Type': 'video/mp4',
            }
            res.writeHead(206, head);
            file.pipe(res);
        } else {
            const head = {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Content-Length': fileSize,
                'Accept-Ranges': 'bytes',
                'Content-Type': 'video/mp4',
            }
            res.writeHead(200, head)
            //fs.createReadStream(path).pipe(res)
        }
    } else {
        // 360p
        console.log('requested 360p quality');
        console.log("range was provided ?" + req.headers.range);

        var convertingPath = '/var/www' + '/files/' + req.query.hash + '/isConverting';
        var convertedPath = '/var/www' + '/files/' + req.query.hash + "/converted";
        const outputMedia = '/var/www' + '/files/' + req.query.hash + '/sd.mkv';
        const originalMedia = fs.readFileSync('/var/www' + '/files/' + req.query.hash + '/mediaPath.txt');

        if(!doesFileExists('/var/www' + '/files/' + req.query.hash + "/done.txt")){
            res.statusCode = 404
            res.end();
            return;
        }
        
        if(doesFileExists(convertingPath) || doesFileExists(convertedPath)){
            console.log("file already exists skipping convertion")
            streamVideo(req.query.hash, req , res);
            return;
        }
        console.log('in file = ' + originalMedia)
        
        console.log('out file = ' + outputMedia)

        fs.writeFile(convertingPath, "yes", (err) => {
            if (err) console.log(err);
        });
        const { exec } = require("child_process");

        //if(false)
        exec("ffmpeg -i '" + originalMedia + "' -vcodec h264 -preset veryfast -vf scale=580:242 -movflags +faststart " + outputMedia, (error, stdout, stderr) => {
            if (error) {
                console.log(`error: ${error.message}`);
                fs.unlink(convertingPath, function (err) {
                    if (err) console.log(err);
                    // if no error, file has been deleted successfully
                    console.log('File deleted!'+convertingPath);
                });
                return;
            }
            if (stderr) {
                console.log(`stderr: ${stderr}`);
                fs.unlink(convertingPath, function (err) {
                    if (err) console.log(err);
                    // if no error, file has been deleted successfully
                    console.log('File deleted! '+convertingPath);
                });
                return;
            }
            console.log(`stdout: ${stdout}`);
            fs.writeFile(convertedPath, "yes", (err) => {
                if (err) console.log(err);
            });
        });

        setTimeout(() => {
            streamVideo(req.query.hash, req , res);
        }, 5000);
    }


});

const streamVideoffmpeg = (hash , req , res) => {
    let path = '/var/www' + '/files/' + hash + '/sd.mkv';
    var convertingPath = '/var/www' + '/files/' + req.query.hash + '/isConverting';
    var convertedPath = '/var/www' + '/files/' + req.query.hash + "/converted";
    const outputMedia = '/tmp/sd.mkv';//'/var/www' + '/files/' + req.query.hash + '/sd.mkv';
    const originalMedia = fs.readFileSync('/var/www' + '/files/' + req.query.hash + '/mediaPath.txt');
    console.log('input = '+originalMedia)
    var ffmpeg = require('fluent-ffmpeg');
    var command = ffmpeg(fs.createReadStream(originalMedia))
    //.input(originalMedia)
    //.output(outputMedia)
    
    //.outputFormat('flashvideo')
    //.audioCodec('libfaac')
    .videoCodec('libx264')
    //.preset('flashvideo')
    .outputOptions([/**'-vcodec h264', '-preset veryfast' ,'-vf scale=580:242',*/'-movflags +faststart'])
    .size('120x30')
    .format('mp4')
    .on('start', function(commandLine) {
        console.log('Spawned Ffmpeg with command: ' + commandLine);
      })
    .on('error', function(err, stdout, stderr) {
        console.log('Error: ' + err.message);
        console.log('ffmpeg output:\n' + stdout);
        console.log('ffmpeg stderr:\n' + stderr);
      })
    .pipe(res, {end:true});
}

app.listen(3001, function () {
    console.log('Example app listening on port 3001!')
})