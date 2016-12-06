rmvpp = (function(rmvpp){ // Extends the rmvpp object

    var pluginName = "template" // ID of the plugin, should be the same as the sub-directory underneath /insights/plugins
    rmvpp.Plugins[pluginName] = {};
    rmvpp.Plugins[pluginName].id = pluginName;
    rmvpp.Plugins[pluginName].displayName = 'Template'; // Name the user sees
    rmvpp.Plugins[pluginName].description = 'Template plugin file that can be used by developers to create new plugins or learn to modify existing ones.'; // Description of the plugin
    rmvpp.Plugins[pluginName].icon = "cog"; // FontAwesome icon for the plugin

    // Mapping between RPD columns and the visualisation
    rmvpp.Plugins[pluginName].columnMappingParameters = [
        {
        	targetProperty:"test", // ID of the property in columnMap object of render function
        	formLabel:"Test", // Name the user will see
        	type: 'dim', // Either dim, fact or hidden - dimension, measure or hidden
            multiple: true, // Boolean for whether you can have more than one column in this section
            conditionalFormat: true, // Allow this to be conditionally formatted
        	required: true, // Indicate to the user that this is required
            desc: 'This is a test' // Description that is displayed to the user
        }
    ];

    // Global configuration for the plugin - must have width and height or size at minimum.
    rmvpp.Plugins[pluginName].configurationParameters = [
        {
			targetProperty:"width", // Name of the property in config object of render function
			label: "Width", // Name the user will see
			inputType: "textbox", // Indicates the UI element for setting this parameter
			inputOptions: { // Sub-parameters for the UI element
				subtype : "number",
				defaultValue : 300
			},
            desc: 'Width of the chart in pixels.' // Description displayed to the user
		},
		{ // Height and width are mandatory properties unless size is specified
			targetProperty:"height",
			label: "Height",
			inputType: "textbox",
			inputOptions: {
				subtype : "number",
				defaultValue : 300
			},
            desc: 'Height of the chart in pixels.'
		}
    ];

    // Interactions the user can make on this visualisation (e.g. click, highlight)
    rmvpp.Plugins[pluginName].actions = [

    ];

    // Reactions this visualisation can have to other interactions. Everything can use filters
    rmvpp.Plugins[pluginName].reactions = [
        {
            id : 'filter',
            name : 'Filter',
            description : 'Accepts a column map and value and filters the report if the subject area matches.',
            type : 'general'
        }
    ];

    // This is provided all of the information required to make the visualisation at run-time.
    // Your code to make the visualisation in the container DOM element should go here.
    rmvpp.Plugins[pluginName].render = function(data, columnMap, config, container, condFormats)   {
        console.log(data, columnMap, config, container, condFormats);
    }

    return rmvpp; // Required to extend rmvpp correctly

}(rmvpp || {})) // Closes the extension
