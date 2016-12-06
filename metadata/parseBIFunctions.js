var fs = require('fs');
var parseString = require('xml2js').parseString;

// Open translation file
// $ORACLE_HOME/bi/bifoundation/web/msgdb/l_en/messages/searchsysmessages.xml
fs.readFile('obiee-functions.xml', function(err, data) {
    var xml = data.toString();

    // JSON describing the function
    var allFuncs = {};
    var funcHier = {};

    // Cleanup XML so it can be parsed well
    xml = xml.replace(/<i>/g, "");
    xml = xml.replace(/<\/i>/g, "");
    xml = xml.replace(/<br\/>/g, "\n");

    parseString(xml, function (err, result) {
        if (err)
            throw err;

        var functions = result.WebMessageTables.WebMessageTable[0].WebMessage;
        function processProp(f, re, prop) {
            var test = re.exec(f.$.name);
            if (test) {
                var name = test[1];
                if (name) {
                    if (!allFuncs.hasOwnProperty(name)) {
                        allFuncs[name] = {};
                    }
                    allFuncs[name][prop] = f.HTML[0];
                }
            }
        }

        // kmsgFunctionSelectorAsinSyntaxHelp
        functions.forEach(function(f) {
            var re = /kmsgFunctionSelector(.*?)SyntaxHelp/;
            processProp(f, /kmsgFunctionSelector(.*?)SyntaxHelp/, 'SyntaxHelp');
            processProp(f, /kmsgFunctionSelectorDesc(.*?)$/, 'Desc');
        });

        // $ORACLE_HOME/user_projects/domains/bi/servers/bi_server1/tmp/_WL_user/analytics/za01ic/war/res/b_mozilla/answers/functionselector.js
        // Prettify the Javascript. Extract the code with the formula definitions. Remove any unnecessary lines (like append('span'))
        // Remove the check for single tenancy. Parse with this code
        fs.readFile('obiee-functions.js', function(err, data) {
            var js = data.toString();
            js = js.split('\n'); // Split lines
            var group, id;
            js.forEach(function(line) {
                // Create group
                if (line.indexOf("itemType='Folder'") > -1) {
                    var exGroup = /"kmsgFunctionSelectorGroup(.*?)"/.exec(line)[1];
                    funcHier[exGroup] = {};
                    group = funcHier[exGroup];
                } else {
                    id = /"kmsgFunctionSelectorDesc(.*?)"/.exec(line)[1];
                    group[id] = {};
                    group[id].Name = /a\+\+, b, "(.*?)"/.exec(line)[1].replace(/_/g, ' ');
                    group[id].Syntax = /saw.answers.getLocalizedString\("kmsgFunctionSelectorDesc.*?"\), "(.*?)"/.exec(line)[1];
                    group[id].Example = /saw.answers.getLocalizedString\("kmsgFunctionSelectorDesc.*"\), "(.*?)"/.exec(line)[1];
                    group[id].SyntaxHelp = allFuncs[id].SyntaxHelp;
                    group[id].Desc = allFuncs[id].Desc;
                }
            });
            fs.writeFile('bi-functions.json', JSON.stringify(funcHier, null, '\t'));
        });
    });
});




// var xml = ""
// parseString(xml, function (err, result) {
//     console.dir(result);
// });
