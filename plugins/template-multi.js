rmvpp = (function(rmvpp){

    var pluginName = "two-data"

    rmvpp.Plugins[pluginName] = {};
    rmvpp.Plugins[pluginName].id = pluginName;
    rmvpp.Plugins[pluginName].displayName = "Two Data";
    rmvpp.Plugins[pluginName].description = '';
	rmvpp.Plugins[pluginName].icon = "hashtag";
    rmvpp.Plugins[pluginName].multipleDatasets = true;

	rmvpp.Plugins[pluginName].columnMappingParameters = {
        'One': [
    		{
    			targetProperty : "first",
    			formLabel : "First Column",
    			type: 'dim',
    			required: true,
                desc: 'First.'
    		}
    	],
        'Two': [
    		{
    			targetProperty : "second",
    			formLabel : "Second Column",
    			type: 'dim',
    			required: true,
                desc: 'Second'
    		}
    	]
    };

	rmvpp.Plugins[pluginName].configurationParameters = [
        {
            targetProperty:"size",
            label: "Font Size",
            inputType: "textbox",
            inputOptions: {
                "subtype" : 'number',
                "min" : 8,
                "max" : 72,
                defaultValue : 40
            },
            desc: 'Generic size.'
        }
	];

	rmvpp.Plugins[pluginName].actions = [];

	rmvpp.Plugins[pluginName].reactions = [
		{
			id : 'filter',
			name : 'Filter',
			description : 'Accepts a column map and value and filters the report if the subject area matches.',
			type : 'general'
		}
	];

	rmvpp.Plugins[pluginName].render = function(data, columnMap, config, container, condFormats) {
		console.log(data);
	};

    return rmvpp;

}(rmvpp || {}))
