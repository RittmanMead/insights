var fs = require( 'fs' );
var path = require( 'path' );

String.prototype.toProperCase = function (plural) {
	var string = this.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
	if (plural) {
		if (string[string.length-1] != 's')
			string += 's';
	}
    return string;
};

function boolToChar(bool) {
    var out;
    if (bool) {
        out = '<i class="fa fa-check"></i>';
    } else {
        out = '<i class="fa fa-times"></i>';
    }
    return out;
}

var start = '../plugins';

rmvpp = {};
rmvpp.Plugins = {};

fs.readdir(start, function( err, files ) {
    files.forEach(function(file) {
        // Assume template file is the only one that does not follow the convention
        if (['template.js', 'template-multi.js'].indexOf(file) == -1) {
            var plugin = start + '/' + file + '/' + file + '.js';
            require(plugin);
        }
    });

    var doc;
    for (p in rmvpp.Plugins) {
        var plugin = rmvpp.Plugins[p];

		if (!plugin.multipleDatasets) {
			doc = '% ' + plugin.displayName + '\n\n';
	        doc += plugin.description + '\n\n';
	        doc += '![' + plugin.displayName + '](../../private-docs/images/plugins/' + p + '.png)\n\n';

	        doc += '## Column Mapping\n\n';
	        doc += '<table><thead><th>Name</th><th>Property</th><th>Column Type</th>';
	        doc += '<th>Multiple</th><th>Required</th><th>Format</th><th>Description</th></thead>';
	        doc += '<tbody>';
	        plugin.columnMappingParameters.forEach(function(colMap) {
	            doc += '<tr>';
	            doc += '<td style="white-space: nowrap;">' + colMap.formLabel + '</td>';
	            doc += '<td><code>' + colMap.targetProperty + '</code></td>';
	            doc += '<td>' + colMap.type.toProperCase() + '</td>';
	            doc += '<td style="text-align: center;">' + boolToChar(colMap.multiple) + '</td>';
	            doc += '<td style="text-align: center;">' + boolToChar(colMap.required) + '</td>';
	            doc += '<td style="text-align: center;">' + boolToChar(colMap.conditionalFormat) + '</td>';
	            doc += '<td>' + colMap.desc + '</td>';
	            doc += '</tr>';
	        });
	        doc += '</tbody></table>\n\n';

			plugin.columnMappingParameters.forEach(function(colMap) {
				if (colMap.config && colMap.config.length > 0) {
					doc += '### `' + colMap.targetProperty + '` Config Options\n\n';
					doc += '<table><thead><th>Name</th><th>Property</th><th>Input Type</th>';
			        doc += '<th>Default</th><th>Description</th></thead>';
			        doc += '<tbody>';

					colMap.config.forEach(function(conf) {
			            doc += '<tr>';
			            doc += '<td style="white-space: nowrap;">' + conf.label + '</td>';
			            doc += '<td><code>' + conf.targetProperty + '</code></td>';
			            doc += '<td>' + conf.inputType.toProperCase() + '</td>';
						if (conf.inputOptions) {
							if (conf.inputOptions.defaultValue) {
								doc += '<td>' + conf.inputOptions.defaultValue + '</td>';
							}
						}
			            doc += '<td>' + conf.desc + '</td>';
			            doc += '</tr>';
			        });
					doc += '</tbody></table>\n\n';
				}
			});

	        doc += '## Configuration\n\n';
	        doc += '<table><thead><th>Name</th><th>Property</th><th>Input Type</th>';
	        doc += '<th>Default</th><th>Description</th></thead>';
	        doc += '<tbody>';

	        plugin.configurationParameters.forEach(function(conf) {
	            doc += '<tr>';
	            doc += '<td style="white-space: nowrap;">' + conf.label + '</td>';
	            doc += '<td><code>' + conf.targetProperty + '</code></td>';
	            doc += '<td>' + conf.inputType.toProperCase() + '</td>';
				if (conf.inputOptions) {
					if (conf.inputOptions.defaultValue) {
	            		doc += '<td>' + conf.inputOptions.defaultValue + '</td>';
					}
				}
	            doc += '<td>' + conf.desc + '</td>';
	            doc += '</tr>';
	        });
	        doc += '</tbody></table>\n\n';

	        if (plugin.actions && plugin.actions.length > 0) {
	            doc += '## Actions\n\n';
	            doc += '<table><thead><th>Name</th><th>Event</th><th>Type</th>';
	            doc += '<th>Columns</th><th>Description</th></thead>';
	            doc += '<tbody>';

	            plugin.actions.forEach(function(action) {
	                doc += '<tr>';
	                doc += '<td style="white-space: nowrap;">' + action.name + '</td>';
	                doc += '<td><code>' + action.trigger + '</code></td>';
	                doc += '<td>' + action.type.toProperCase() + '</td>';
	                doc += '<td><code>' + action.output.join(',') + '</code></td>';
	                doc += '<td>' + action.description + '</td>';
	                doc += '</tr>';
	            });
	            doc += '</tbody></table>\n\n';
	        }

			if (plugin.specialCondFormats && plugin.specialCondFormats.length > 0) {
				doc += '## Conditional Formatting\n\n';
				doc += '<table><thead><th>Name</th><th>ID</th>';
	            doc += '<th>Require Value</th><th>Description</th></thead>';
	            doc += '<tbody>';
				plugin.specialCondFormats.forEach(function(cf) {
	                doc += '<tr>';
	                doc += '<td style="white-space: nowrap;">' + cf.name + '</td>';
	                doc += '<td><code>' + cf.id + '</code></td>';
	                doc += '<td style="text-align: center;">' + boolToChar(!cf.noValue) + '</td>';
	                doc += '<td>' + cf.description + '</td>';
	                doc += '</tr>';
	            });
	            doc += '</tbody></table>\n\n';
			}

	        if (plugin.reactions && plugin.reactions.length > 0) {
	            doc += '## Reactions\n\n';
	            doc += '<table><thead><th>Name</th><th>ID</th><th>Type</th>';
	            doc += '<th>Description</th></thead>';
	            doc += '<tbody>';

	            plugin.reactions.forEach(function(action) {
	                doc += '<tr>';
	                doc += '<td style="white-space: nowrap;">' + action.name + '</td>';
	                doc += '<td><code>' + action.id + '</code></td>';
	                doc += '<td>' + action.type.toProperCase() + '</td>';
	                doc += '<td>' + action.description + '</td>';
	                doc += '</tr>';
	            });
	            doc += '</tbody></table>\n\n';
	        }

	        fs.writeFile(start + '/' + p + '/doc.md', doc);
		}
    }
});
