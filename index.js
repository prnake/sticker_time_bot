const config = require('./config');
const TelegramBot = require('node-telegram-bot-api');
const { createLogger, format, transports } = require('winston');
const { combine, timestamp, label, prettyPrint } = format;
const fs = require('fs');
const moment = require('moment-timezone');
const CronJob = require('cron').CronJob;

const logger = createLogger({
    level: (typeof config.level == 'undefined') ? 'info' : config.level,
    format: combine(
        timestamp(),
        prettyPrint()
    ),
    transports: [
        new transports.Console(),
        new transports.File({ filename: config.log_file })
    ]
});

const token = config.tg_bot_token;

const stickers = [
    'CAACAgUAAxkBAAEBEpFfFUPrzDvIvYmvTBPD1fxQVE9N1gACDAADm4E2Kwnp-Ma7k_CBGgQ',
    'CAACAgUAAxkBAAEBEntfFUPJEZJT2flj2kRDCFyRVQwkJAACAQADm4E2K9WKs6SKyXDCGgQ',
    'CAACAgUAAxkBAAEBEn1fFUPRgS73GfQGVEXEeYbKuVwe4gACAgADm4E2K7TvBnfvjJ25GgQ',
    'CAACAgUAAxkBAAEBEn9fFUPUmsBlaXgaR8Vz4yvNowkZSAACAwADm4E2K-6hjdOV9KKJGgQ',
    'CAACAgUAAxkBAAEBEoFfFUPXalFy3ckRuHZ-JpyXcagn2gACBAADm4E2K1vPIqEUO4xhGgQ',
    'CAACAgUAAxkBAAEBEoNfFUPa5TqQU4jeHm9JC-gePEGvfAACBQADm4E2K9dWgmou8odTGgQ',
    'CAACAgUAAxkBAAEBEoVfFUPc3ooAAdc1rBxLKEFrHpPia38AAgYAA5uBNiutIK0u29DHVBoE',
    'CAACAgUAAxkBAAEBEodfFUPewxJQVhy-DNf_G1NMEQWligACBwADm4E2K7iKcnF6qabqGgQ',
    'CAACAgUAAxkBAAEBEolfFUPhK0LAj13exByzGmuuOoXuvQACCAADm4E2K8E-Xd1vz0C8GgQ',
    'CAACAgUAAxkBAAEBEotfFUPkPEP0ugbqG8Oa_jXOV5cjdAACCQADm4E2KzpiZGIOJHfmGgQ',
    'CAACAgUAAxkBAAEBEo1fFUPmTq-YvOBDlp8tWgv7GA6wqwACCgADm4E2KzOEdAfxxzUkGgQ',
    'CAACAgUAAxkBAAEBEo9fFUPpAaF2iMY7IGb8GZWfVRnLtwACCwADm4E2K4v5dW3Zw5KyGgQ'
];

const bot = new TelegramBot(token, { polling: true });

if (fs.existsSync('./data.json')) {
    var fdata = fs.readFileSync('./data.json', 'utf8');
    var data = JSON.parse(fdata);
    logger.info('Old data: ' + JSON.stringify(data));
}

function saveData() {
    json = JSON.stringify(data);
    fs.writeFile('./data.json', json, 'utf8');
}

if (typeof data == 'undefined' || data == null) {
    logger.info('No data.json');
    var data = {
        chatids: [],
        tzmap: {},
        lastid: {},
        autodelete: {}
    };
    saveData();
}

if (typeof data.chatids == 'undefined' || data.chatids == null) {
    data.chatids = [];
    saveData();
}

if (typeof data.tzmap == 'undefined' || data.tzmap == null) {
    data.tzmap = {};
    saveData();
}

if (typeof data.lastid == 'undefined' || data.lastid == null) {
    data.lastid = {};
    saveData();
}

if (typeof data.sleeptime == 'undefined' || data.sleeptime == null) {
    data.sleeptime = {};
    saveData();
}

if (typeof data.waketime == 'undefined' || data.waketime == null) {
    data.waketime = {};
    saveData();
}
if (typeof data.autodelete == 'undefined' || data.autodelete == null) {
    data.autodelete = {};
    saveData();
}

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    let index = data.chatids.indexOf(chatId);
    if (index > -1) {
        bot.sendMessage(chatId, 'Already started, chat ID: ' + chatId);
        return;
    }
    data.chatids.push(chatId);
    delete data.lastid[chatId];
    saveData();
    logger.info(chatId + ' started');
    bot.sendMessage(chatId, 'Started, chat ID: ' + chatId);
});

bot.onText(/^\/timezone(@pkaclockbot)?(\s+([^\s]+))?$/, (msg, match) => {
    const chatId = msg.chat.id;
    if (match[3]) {
        if (moment.tz.zone(match[3])) {
            logger.info(chatId + ' set timezone to ' + match[3]);
            bot.sendMessage(chatId, 'Set timezone to ' + match[3]);
            data.tzmap[chatId] = match[3];
            saveData();
        } else {
            bot.sendMessage(chatId, 'Invalid timezone: ' + match[3]);
        }
    } else {
        let tz = data.tzmap[chatId];
        if (tz) {
            bot.sendMessage(chatId, 'Current timezone: ' + data.tzmap[chatId]);
        } else {
            bot.sendMessage(chatId, 'Timezone not set, by default Asia/Shanghai.');
        }
    }
});

bot.onText(/^\/autodelete(@pkaclockbot)?(\s+([^\s]+))?$/, (msg, match) => {
    const chatId = msg.chat.id;
    let index = data.chatids.indexOf(chatId);
    if (index <= -1) {
        bot.sendMessage(chatId, 'Not started, chat ID: ' + chatId);
        return;
    }
    if (match[3]) {
        if (match[3] === 'on') {
            bot.sendMessage(chatId, 'Enable auto deleting');
            data.autodelete[chatId] = true;
            saveData();
            logger.info(chatId + ' set autodelete: on');
        } else if (match[3] === 'off') {
            bot.sendMessage(chatId, 'Disable auto deleting');
            data.autodelete[chatId] = false;
            saveData();
            logger.info(chatId + ' set autodelete: off');
        } else {
            bot.sendMessage(chatId, 'Unknown command');
        }
    } else {
        if (chatId in data.autodelete) {
            bot.sendMessage(chatId, 'Auto deleting status: ' + (data.autodelete[chatId] ? 'on' : 'off'));
        } else {
            bot.sendMessage(chatId, 'Auto deleting not set, by default off.');
        }
    }
});

bot.onText(/^\/sleeptime(@pkaclockbot)?(\s+([^\s]+))?$/, (msg, match) => {
    const chatId = msg.chat.id;
    // bot.sendMessage(chatId, match[0]+'  '+match[1]+'  '+match[2]+'  '+match[3])
    if (match[3]) {
        var num = parseInt(match[3], 10);
        if (num <= 23 && num >= 0){
            logger.info(chatId + ' set sleeptime to '+ num +':00');
            bot.sendMessage(chatId, 'Set sleeptime to '+ num +':00');
            data.sleeptime[chatId] = num;
            saveData();
        } else {
            bot.sendMessage(chatId, match[3]+' is a invalid time, 0-23 expected');
        }
    } else {
        if (chatId in data.sleeptime) {
            bot.sendMessage(chatId, "Current sleep time: " + data.sleeptime[chatId]);
        } else {
            bot.sendMessage(chatId, "Sleep time not set");
        }
    }
});

bot.onText(/^\/waketime(@pkaclockbot)?(\s+([^\s]+))?$/, (msg, match) => {
    const chatId = msg.chat.id;
    if (match[3]) {
        var num = parseInt(match[3], 10);
        if (num <= 23 && num >= 0){
            logger.info(chatId + ' set waketime to '+ num +':00');
            bot.sendMessage(chatId, 'Set waketime to '+ num +':00');
            data.waketime[chatId] = num;
            saveData();
        } else {
            bot.sendMessage(chatId, match[3]+' is a invalid time, 0-23 expected');
        }
    } else {
        if (chatId in data.waketime) {
            bot.sendMessage(chatId, "Current wake time: " + data.waketime[chatId]);
        } else {
            bot.sendMessage(chatId, "Wake time not set");
        }
    }
});


bot.onText(/\/stop/, (msg) => {
    const chatId = msg.chat.id;
    let index = data.chatids.indexOf(chatId);
    if (index > -1) {
        data.chatids.splice(index, 1);
        delete data.lastid[chatId];
        saveData();
    } else {
        bot.sendMessage(chatId, 'Not started, chat ID: ' + chatId);
        return;
    }
    logger.info(chatId + ' stopped');
    bot.sendMessage(chatId, 'Stopped, chat ID: ' + chatId);
});

// bot.on('sticker', (msg) => {
    // const chatId = msg.chat.id;
    // logger.info('[' + chatId + '] ' + msg.sticker.file_id);
// });

bot.on('polling_error', (error) => {
    logger.error('[polling_error] ' + error.code);  // => 'EFATAL'
});

bot.on('webhook_error', (error) => {
    logger.error('[webhook_error] ' + error.code);  // => 'EPARSE'
});

var cron = new CronJob('0 * * * *', function() {
    var date = new Date();
    logger.info('Cron triggered: ' + date + ', send sticker to ' + data.chatids.length + ' chats');
    data.chatids.forEach(function (id) {
        let tz = data.tzmap[id];
        if (!tz) {
            tz = 'Asia/Shanghai';
        }
        let hour = moment().tz(tz).hours();

        if (id in data.sleeptime && id in data.waketime) {
            let sleep = data.sleeptime[id];
            let wake = data.waketime[id];
            if (sleep < wake) {
                if (hour > sleep && hour < wake) return;
            }
            if (sleep > wake) {
                if (hour > sleep || hour < wake) return;
            }
        }
        logger.debug('Send to ' + id);
        bot.sendSticker(id, stickers[hour % 12]).then(message => {
            let cid = message.chat.id;
            let mid = message.message_id;
            if (data.autodelete[cid] && data.lastid[cid]) {
                bot.deleteMessage(cid, data.lastid[cid]);
            }
            data.lastid[cid] = mid;
            saveData();
        }).catch(error => {
            let query = error.response.request.uri.query;
            let matches = query.match(/chat_id=(.*)&/);
            if (matches && matches[1]) {
                let cid = Number(matches[1]);
                if (isNaN(cid)) {
                    // Channel name
                    cid = matches[1];
                    cid = cid.replace('%40', '@');
                }
                logger.error('[' + error.response.body.error_code + '](' + cid + ')' + error.response.body.description);  // => 'ETELEGRAM'
                if (query && (error.response.body.error_code === 403 || error.response.body.error_code === 400) &&
                (error.response.body.description.includes('blocked') ||
                    error.response.body.description.includes('kicked') ||
                    error.response.body.description.includes('not a member') ||
                    error.response.body.description.includes('chat not found') ||
                    error.response.body.description.includes('upgraded') ||
                    error.response.body.description.includes('deactivated') ||
                    error.response.body.description.includes('not enough rights') ||
                    error.response.body.description.includes('have no rights') ||
                    error.response.body.description.includes('CHAT_SEND_STICKERS_FORBIDDEN'))) {
                    logger.info('Blocked by ' + cid);
                    let index = data.chatids.indexOf(cid);
                    if (index > -1) {
                        data.chatids.splice(index, 1);
                        delete data.tzmap[cid];
                        delete data.lastid[cid];
                        delete data.autodelete[cid];
                        delete data.sleeptime[cid];
                        delete data.waketime[cid];
                        saveData();
                    }
                }
            }
        })
    });
}, null, true, 'Asia/Shanghai');
