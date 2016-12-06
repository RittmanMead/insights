rmvpp = (function(rmvpp){

    var pluginName = "measure-tile"

    rmvpp.Plugins[pluginName] = {};
    rmvpp.Plugins[pluginName].id = pluginName;
    rmvpp.Plugins[pluginName].displayName = "Measure Tile";
    rmvpp.Plugins[pluginName].description = 'Measure tile displaying aggregated numerical figures. Has built in conditional formatting (i.e. not using the generic framework yet) between configured values which display up/down arrows and fade to the configured colours. Animates the number count from 0 to the value.';
	rmvpp.Plugins[pluginName].icon = "hashtag";

	rmvpp.Plugins[pluginName].columnMappingParameters = [
		{
			targetProperty : "measure",
			formLabel : "Measure",
			type: 'dim',
			required: true,
			conditionalFormat: 'icon',
            desc: 'Single, aggregated measure to display.'
		},
		{
			targetProperty : "hidden",
			formLabel : "Hidden",
			multiple: true,
			type: 'hidden',
            desc: 'Hidden column for conditional formatting.'
		}
	];

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
            desc: 'Size of the font to display the tile in'
        },
        {
			targetProperty:"numFont",
			label: "Number Font",
			inputType: "font",
			inputOptions: { "defaultValue": "Consolas"	},
            desc: 'Font for the number (not the label).'
		},
		{
			targetProperty:"colour",
			label: "Colour",
			inputType: "colour",
			inputOptions: {
				"defaultValue": "#333333"
			},
            desc: 'Colour of the measure tile.'
		},
		{
			targetProperty:"icon",
			label: "Icon",
			inputType: "icon",
			inputOptions: { "defaultValue": ""	},
            desc: '[Font Awesome](http://fontawesome.io/icons/) icon to display on the tile.'
		},
        {
			targetProperty:"animation",
			label: "Animation Duration",
			inputType: "textbox",
			inputOptions: { "subtype": "number", "defaultValue": 1000	},
            desc: 'Duration of the animation in ms.'
		},
        {
			targetProperty:"many",
			label: "Default",
			inputType: "textbox",
			inputOptions: { "defaultValue": "All"	},
            desc: 'Value to display if there are multiple attributes returned in the dataset.'
		},
        {
			targetProperty:"hideLabel",
			label: "Hide Label",
			inputType: "checkbox",
			inputOptions: { "defaultValue": false	},
            desc: 'Hides the label for the attribute.'
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
		// Render container div
		var tileContainer = d3.select(container)
			.append('div')
			.classed('measure-tile', true);

        var agg;
        if (columnMap.measure.Measure == 'none') {
            if (data.length > 1) {
                agg = config.many;
            } else {
                agg = data[0].measure;;
            }
        } else {
            agg = d3[rmvpp.convertMeasure(columnMap.measure.Measure)](data.map(function(d) { return +d.measure; }));
        }

        if (!config.hideLabel) {
            var label = tileContainer.append('div')
    			.classed('label', true)
    			.style('font-family', "'Open Sans', Calibri, Arial")
    			.style('font-size', d3.max([12, config.size/2]) + 'px')
    			.style('text-align', 'center')
    			.text(columnMap.measure.Name);
        }

		var value = tileContainer.append('div')
			.classed('value', true)
			.style('font-family', config.numFont + ', Arial')
			.style('font-size', config.size + 'px')
			.style('color', '#333')

		value.append('span')
			.text(agg);
		value.append('i')
			.attr('class', 'fa')
			.style('margin-left', '10px')
			.style('opacity', 0)

		var colour = config.colour;
		if (config.icon)
			value.selectAll('i').classed('fa-' + config.icon, true)

		function applyStyle(cf) {
			var colour = cf.Style.colour;
			if (cf.Style.icon) {
				value.selectAll('i').classed('fa-' + config.icon, false);
				value.selectAll('i').classed('fa-' + cf.Style.icon, true);
			}
			return colour;
		}

		// Assume only one datum
		condFormats.forEach(function(cf) {
            if (columnMap.measure.Measure != 'none') {
    			if (cf.compare(agg)) {
    				colour = applyStyle(cf);
    			}
            } else {
                if (cf.compare(data[0])) {
                    colour = applyStyle(cf);
                }
            }
		});

		value.transition()
			.style('color', colour)
			.duration(+config.animation);
		value.selectAll('i').transition()
			.style('opacity', 1)
			.duration(+config.animation);

        if (columnMap.measure.Measure != 'none') {
    		$({countNum: 0}).animate({countNum: agg}, {
    			duration: +config.animation,
    			easing:'swing',
    			step: function() {
    				$(container).find('.value>span').text(columnMap.measure.format(this.countNum));
    			},
    			complete: function() { // If the value has not incremented fully, set it anyway
    				$(container).find('.value>span').text(columnMap.measure.format(agg));
    			}
    		});
        } else {
            $(container).find('.value>span').hide();
            $(container).find('.value>span').fadeIn(+config.animation);
        }
	};

    return rmvpp;

}(rmvpp || {}))
