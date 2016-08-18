/**
 * @author ianzhang
 */
var fs = require('fs');

function getConfig() {
    var json = {};
    if (fs.existsSync("config.json")) {
        var str = fs.readFileSync("config.json", "utf-8");
        json = JSON.parse(str);
    }

    return json;
}

exports.getConfig = getConfig;
