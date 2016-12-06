 rmvpp = (function(rmvpp){

    var pluginName = "word-cloud"
    rmvpp.Plugins[pluginName] = {};
    rmvpp.Plugins[pluginName].id = pluginName;
    rmvpp.Plugins[pluginName].displayName = "Word Cloud";
    rmvpp.Plugins[pluginName].description = 'Word cloud (also known as tag cloud or weighted) list visualisation. Here the attribute word will be sized based on the equivalent measure value. The positioning on the canvas is determined by one of two configurable algorithms. The word colours are also configurable.';
	rmvpp.Plugins[pluginName].icon = "font";

    rmvpp.Plugins[pluginName].columnMappingParameters = [
    	{
			targetProperty:"word",
			formLabel:"Word",
			type: 'dim',
			required: true,
            desc: 'Attribute column representing the words for the cloud.'
		},
		{
			targetProperty:"freq",
			formLabel:"Frequency",
			type: 'fact',
			required: true,
            desc: 'Measure column giving the data for the size weightings.'
		},
    ];

    rmvpp.Plugins[pluginName].configurationParameters = [
        {
			targetProperty:"width",
			label: "Width",
			inputType: "textbox",
			inputOptions: {
				subtype : "number",
				defaultValue : 400
			},
            desc: 'Width of the canvas in pixels.'
		},
		{
			targetProperty:"height",
			label: "Height",
			inputType: "textbox",
			inputOptions: {
				subtype : "number",
				defaultValue : 400
			},
            desc: 'Height of the canvas in pixels.'
		},
		{
			targetProperty:"spiral",
			label: "Layout Algorithm",
			inputType: "radio",
			inputOptions: {
				"values":["Archimedean", "Rectangular"] ,
				"defaultValue": "Archimedean"
			},
            desc: 'Either *Archimedean* or *Rectangular*, chooses that algorithm that determines the positioning of the words on the canvas.'
		},
		{
			targetProperty:"scale",
			label: "Sizing Scale",
			inputType: "radio",
			inputOptions: {
				"values":["Linear", "Log"] ,
				"defaultValue": "Linear"
			},
            desc: 'Chooses either linear or log scale for sizing.'
		},
        {
			targetProperty:"minSize",
			label: "Minimum Font Size",
			inputType: "textbox",
			inputOptions: {
                "subType" : 'number',
				"defaultValue": 12
			},
            desc: 'Minimum font size for the tags.'
		},
        {
			targetProperty:"maxSize",
			label: "Maximum Font Size",
			inputType: "textbox",
			inputOptions: {
                "subType" : 'number',
				"defaultValue": 36
			},
            desc: 'Maximum font size for the word tags.'
		},
		{
			targetProperty:"font",
			label: "Font",
			inputType: "font",
			inputOptions: {
				"defaultValue": "Open Sans"
			},
            desc: 'Font of the word tags.'
		},
		{
			targetProperty:"orientations",
			label: "Number of Orientations",
			inputType: "textbox",
			inputOptions: {
                "subType" : 'number',
				"defaultValue":  5
			},
            desc: 'Choose a number of different orientations between the given angles (min -90, max 90).'
		},
        {
			targetProperty:"fromAngle",
			label: "From Angle",
			inputType: "range",
			inputOptions: {
                "subType" : 'number',
                "min" : -90,
                "max" : 90,
				"defaultValue": -60
			},
            desc: 'Minimum angle of orientation for a word in the cloud.'
		},
        {
			targetProperty:"toAngle",
			label: "To Angle",
			inputType: "range",
			inputOptions: {
                "subType" : 'number',
                "min" : -90,
                "max" : 90,
				"defaultValue": 60
			},
            desc: 'Maximum angle of orientation for a word in the cloud.'
		},
		{
			targetProperty:"colours",
			label: "Colours",
			inputType: "palette",
			inputOptions: { "defaultValue": "Flat-UI" },
            desc: 'Colour pelette defining possible colours for the words.'
		}
    ];

	rmvpp.Plugins[pluginName].actions = [
		{
			'trigger' : 'wordClick',
			'type' : 'click',
			'output' : ['word'],
			'name' : 'Click - Word',
			'description' : 'Click on a word to pass the column map and value.'
		},
		{
			'trigger' : 'wordHover',
			'type' : 'hover',
			'output' : ['word'],
			'name' : 'Hover - Word',
			'description' : 'Hover over a word to pass the column map and value.'
		}
	];

	rmvpp.Plugins[pluginName].reactions = [
		{
			id : 'filter',
			name : 'Filter',
			description : 'Accepts a column map and value and filters the report if the subject area matches.',
			type : 'general'
		}
	];

    rmvpp.Plugins[pluginName].render = function(data, columnMap, config, container)   {

        var d3Scale = d3.scale.linear();//, fill = d3.scale.category20();
        var palette = rmvpp.getPalette(config.colours);
        var fill = d3.scale.ordinal().range(palette);
        d3Scale.domain([0, config.orientations - 1]).range([config.fromAngle, config.toAngle]);

        var layout = d3.layout.cloud()
			.size([config.width, config.height])
			.fontSize(function(d) { return fontSize(+d.freq); })
			.text(function(d) { return d.word; })
			.rotate(function() {
			  return d3Scale(~~(Math.random() * config.orientations));
			})
    		.on("end", draw);

		var wordContainer = d3.select(container).append('div')
			.classed('word-cloud', true);

    	var svg = wordContainer.append("svg")
			.attr("width", config.width)
			.attr("height", config.height);

		var vis = svg.append("g").attr("transform", "translate(" + [config.width >> 1, config.height >> 1] + ")");

        var tooltip = new rmvpp.Tooltip(wordContainer[0][0]); // Create tooltip object

		// Draw cloud function
		function draw(data, bounds) {
			scale = bounds ? Math.min(
				config.width / Math.abs(bounds[1].x - config.width / 2),
				config.width / Math.abs(bounds[0].x - config.width / 2),
				config.height / Math.abs(bounds[1].y - config.height / 2),
				config.height / Math.abs(bounds[0].y - config.height / 2)
			) / 2 : 1;

			words = data;

			var text = vis.selectAll("text")
					.data(words, function(d) { return d.text.toLowerCase(); });
				text.classed('nonSelect', true);
				text.transition()
					.duration(1000)
					.attr("transform", function(d) { return "translate(" + [d.x, d.y] + ") rotate(" + d.rotate + ")"; })
					.style("font-size", function(d) { return d.size + "px"; });
				text.enter().append("text")
					.attr("text-anchor", "middle")
					.attr("transform", function(d) { return "translate(" + [d.x, d.y] + ") rotate(" + d.rotate + ")"; })
					.style("font-size", "1px")
				.transition()
					.duration(1000)
					.style("font-size", function(d) { return d.size + "px"; });
				text.style("font-family", function(d) { return d.font; })
					.style("fill", function(d) {
						Math.floor(Math.random() * 5)
						return fill(d.text.toLowerCase());
					})
                    .style("cursor", "pointer")
    				.text(function(d) { return d.text; })
    				.on("mouseover", function(d, i) { // Custom wordHover trigger
                        tooltip.displayHTML('<b>' + columnMap.freq.Name + ': </b>' + columnMap.freq.format(d.freq), d3.event);
    					rmvpp.createTrigger(pluginName, columnMap, container, 'wordHover', d);
    				})
                    .on("mouseout", function(d, i) { // Custom wordHover trigger
                        tooltip.hide();
    					rmvpp.createTrigger(pluginName, columnMap, container, 'wordHover', d);
    				})
    				.on("click", function(d, i) { // Custom wordClick trigger
    					rmvpp.createTrigger(pluginName, columnMap, container, 'wordClick', d);
    				});

			vis.transition()
				.delay(1000)
				.duration(750)
				.attr("transform", "translate(" + [config.width >> 1, config.height >> 1] + ") scale(" + scale + ")");
		}

		// Generate/regenerate function
		function generate() {
			layout
				.font(config.font)
				.spiral(config.spiral.toLowerCase())
			min = d3.min(data, function(d) { return +d.freq;} );
			max = d3.max(data, function(d) { return +d.freq;} );
			fontSize = d3.scale[config.scale.toLowerCase()]().domain([min, max]).range([config.minSize, config.maxSize]); // Scale fonts based on config parameters
			complete = 0;
			words = [];
			layout.stop().words(data).start();
		}

		generate();
    }

    return rmvpp;

}(rmvpp || {}))
