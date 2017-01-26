/**
 * @overview RM Insights OBIEE module
 * @version 1.00
 * @author Minesh Patel
*/

/**
	* Core configuration parameters for Insights. Can be extended and overidden in `config.js`.
    * This file is maintained in the Git repository and so will get updated with new versions.
	* @exports InsightsConfig
*/
var InsightsConfig = (function() {
    var InsightsConfig = {};

    /**
        * Security configuration linking OBIEE application roles to privileges in the web app. Should use
        * the principal name instead of the display name.
        * @property {string} view Allows viewing of reports using `view.html`.
        * @property {string} create Allows creation of reports using `visBuilder.html`.
    */
    InsightsConfig.Security = {
        view: 'AuthenticatedUser',
        create: 'AuthenticatedUser'
    }

    /** Default locale for date and currency formatting. */
    InsightsConfig.Locale = 'GB';

    /**
        * Defines colour palettes to be used for configuring visualisations.
        * `Custom` is a reserved property name , other than that, any property name can be
        * used to define a palette. There is no limit to the number of colours defined on a
        * given palette.
    */
    InsightsConfig.Palettes = {
        'Flat-UI' : ['#3598DC', '#2FCC71', '#E84C3D', '#34495E', '#E77E23', '#9C59B8'],
        'Flat-UI-Soft' : ['#5DA5DA', '#60BD68', '#F15854', '#4D4D4D', '#FAA43A', '#B276B2'],
        'Cool-Scale' : ['#BEE0CC', '#70C3D0', '#419DC5', '#316BA7', '#223B89', '#151E5E'],
        'Warm-Scale' : ['#FDEB73', '#F6C15B', '#ED9445', '#E66731', '#B84A29', '#6A3A2D'],
        'Heatmap' : ['#0066FF', '#00F0FF', '#00FF19', '#EBFF00', '#FF0000']
    };

    /** List of possible fonts to have in the font picker.
    Only those installed on the client device will be shown to the user. */
    InsightsConfig.Fonts = [
        'Arial',
        'Arial Black',
        'Avenir',
        'Book Antiqua',
        'Bookman Old Style',
        'Century Gothic',
        'Consolas',
        'Courier New',
        'Fantasy',
        'Georgia',
        'Helvetica',
        'Impact',
        'King',
        'Modena',
        'Open Sans',
        'Tahoma',
        'Times New Roman',
        'Trebuchet MS',
        'Verdana'
    ];

    /**
        * Customise the SI prefixes for the `s` D3 number format.
    */
    InsightsConfig.SIPrefixes = {
        'k' : 'k', // Kilo (10^3)
        'M' : 'M', // Mega (10^6)
        'G' : 'G' // Giga (10^9)
    }

    /**
        * Default data format strings for each data type.
    */
    InsightsConfig.DataFormats = {
        'double' : '.3s',
        'numeric' : '.3s',
        'integer' : '.0f',
        'date' : '%d/%m/%Y',
        'timestamp' : '%d/%m/%Y %H:%M',
        'varchar' : '%s'
    }

    /**
        * Stores UI application modifications
        * @property {object} Colours Colours used for dynamic highilghting in the application.
        * Can change these when changing the application theme.
        * @property {object} Buttons Some buttons can be hidden from the UI and that is configured here.
        * E.g. the logoff button can be hidden on SSO enabled environments.
    */
    InsightsConfig.UI = {
        Buttons: {
            logoff: true // Set to false for SSO environments
        }
    }

    /**
        * TopoJSON map files that are configured for use with the map picker.
        * Paths are relative to the `/insights/topojson` directory.
    */
    InsightsConfig.MapFeatures = [
        {'name': 'UK - NUTS 1', 'path': 'uk/nuts1.json'},
        {'name': 'US - States', 'path': 'us/states.json'},
        {'name': 'US - States (Mainland)', 'path': 'us/states-mainland.json'},
        {'name': 'US - Counties', 'path': 'us/counties.json'},
        {'name': 'World Countries', 'path': 'world.json'}
    ];

    /**
        * Leaflet JS map tile layer.
    */
    InsightsConfig.MapTiles = {
        'OSM': {
            url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
            options: {attribution: '&copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>'},
            crossOriginKeyword: null
        },
        'Topology': {
            url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
            options: {attribution: 'Map data: &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'},
            crossOriginKeyword: null
        },
        'Hydda': {
            url: 'https://{s}.tile.openstreetmap.se/hydda/full/{z}/{x}/{y}.png',
            options: {attribution: 'Tiles courtesy of <a href="http://openstreetmap.se/" target="_blank">OpenStreetMap Sweden</a> &mdash; Map data &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'},
            crossOriginKeyword: null
        },
        'Toner': {
            url: 'https://stamen-tiles-{s}.a.ssl.fastly.net/toner-lite/{z}/{x}/{y}.{ext}',
            options: {
                attribution: 'Map tiles by <a href="http://stamen.com">Stamen Design</a>, <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a> &mdash; Map data &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
                subdomains: 'abcd',
                ext: 'png',
                minZoom: 0,
                maxZoom: 20
            },
            crossOriginKeyword: null
        },
        'Watercolour': {
            url: 'https://stamen-tiles-{s}.a.ssl.fastly.net/watercolor/{z}/{x}/{y}.{ext}',
            options: {
                attribution: 'Map tiles by <a href="http://stamen.com">Stamen Design</a>, <a href="http://creativecommons.org/licenses/by/3.0">CC BY 3.0</a> &mdash; Map data &copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>',
                subdomains: 'abcd',
                ext: 'png',
                minZoom: 1,
                maxZoom: 16
            },
            crossOriginKeyword: null
        },
        'ESRI': {
            url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
            options: {attribution: 'Tiles &copy; Esri &mdash; Source: Esri, DeLorme, NAVTEQ, USGS, Intermap, iPC, NRCAN, Esri Japan, METI, Esri China (Hong Kong), Esri (Thailand), TomTom, 2012'},
            crossOriginKeyword: null
        },
        'Satellite': {
            url: 'https://map1.vis.earthdata.nasa.gov/wmts-webmerc/MODIS_Terra_CorrectedReflectance_TrueColor/default/{time}/{tilematrixset}{maxZoom}/{z}/{y}/{x}.{format}',
            options: {
                attribution: 'Imagery provided by services from the Global Imagery Browse Services (GIBS), operated by the NASA/GSFC/Earth Science Data and Information System (<a href="https://earthdata.nasa.gov">ESDIS</a>) with funding provided by NASA/HQ.',
                bounds: [[-85.0511287776, -179.999999975], [85.0511287776, 179.999999975]],
                minZoom: 1,
                maxZoom: 9,
                format: 'jpg',
                time: '',
                tilematrixset: 'GoogleMapsCompatible_Level'
            },
            crossOriginKeyword: null
        },
        'Night' : {
            url: 'http://map1.vis.earthdata.nasa.gov/wmts-webmerc/VIIRS_CityLights_2012/default/{time}/{tilematrixset}{maxZoom}/{z}/{y}/{x}.{format}',
            options: {
                attribution: 'Imagery provided by services from the Global Imagery Browse Services (GIBS), operated by the NASA/GSFC/Earth Science Data and Information System (<a href="https://earthdata.nasa.gov">ESDIS</a>) with funding provided by NASA/HQ.',
                bounds: [[-85.0511287776, -179.999999975], [85.0511287776, 179.999999975]],
                minZoom: 1,
                maxZoom: 8,
                format: 'jpg',
                time: '',
                tilematrixset: 'GoogleMapsCompatible_Level'
            },
            crossOriginKeyword: null
        }
    };

    /** Default tile for Leaflet maps. */
    InsightsConfig.DefaultMapTile = 'OSM';

    /**
		* Holds version of OBIEE WSDL file, containing SOAP structure for all available methods.
		* 11.1.1.7 has v8 as the latest, 11.1.1.9 has v9 and 12c has v12. These are generally compatible with
		* each other but the version can be changed/overidden here if necessary.
	*/
    InsightsConfig.WSDLVersion = 'v10';

    /**
        * Automatically converts NUMERIC datatypes to DOUBLE. This prevents a very serious reporting error
        * but exposes a [floating point limitation](https://docs.oracle.com/cd/E28280_01/bi.1111/e10540/data_types.htm#BIEMG4605).
        * This has not been fixed or recognised by Oracle as of 2016-08-06.
    */
    InsightsConfig.NumericToDouble = true;

    return InsightsConfig;
}());
