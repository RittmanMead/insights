#!/usr/bin/python
#
# Script to convert markdown to HTML and apply styling
#
# Prerequisites:
#	Pandoc (http://johnmacfarlane.net/pandoc/)
#

# Standard python distribution libraries:
import os, sys
import re, argparse, mimetypes
import tempfile, base64
from glob import glob
from subprocess import Popen, PIPE, STDOUT

# Context manager for changing the current working directory
class cd:
	def __init__(self, newPath):
		self.newPath = newPath

	def __enter__(self):
		self.savedPath = os.getcwd()
		os.chdir(self.newPath)

	def __exit__(self, etype, value, traceback):
		os.chdir(self.savedPath)

# Write to files
def write_output(line, filename, mode='a'):
	with open(filename,mode) as output:
		line = line.encode('utf-8')
		output.write('%s\n' % line)
		output.close()

# Read file
def read_file(filename):
	with open(filename, 'r') as f:
		f.seek(0)
		output = f.read()
		f.close()
	return output

# Delete open file
def delete_file(f):
	try:
		if type(f) is not str:
			f.close()
			f = f.name
		if os.path.exists(f):
			os.remove(f)
		return True

	except Exception, err:
		print('Could not delete file %s.' % f)
		print('Exception: %s' % err)
		return False

# Create all folders in a list
def create_folders(folder_array):
	for folder in (folder_array):
		if not os.path.exists(folder):
			if DEBUG:
				print '\t\tCreating %s' % folder
			os.makedirs(folder)

def init():
	global SCRIPT_DIR, CURRENT_DIR, OUTPUT_DIR, DIR
	global SINGLE_FILE, MANUAL_OUTPUT
	global CONTENTS, NUMBER_SECTIONS, MATHS
	global CSS, HEADER, FONTS

	SCRIPT_DIR = os.path.abspath(os.path.dirname(sys.argv[0]))
	CURRENT_DIR = os.getcwd()
	os.chdir(SCRIPT_DIR) # Change to script directory

	parser = argparse.ArgumentParser(description="Rittman Mead Markdown to HTML Converter")
	parser.add_argument('path', action='store', help='Argument of markdown file to convert.')
	parser.add_argument('-a', '--all', action='store_true', default=False, help='Specifies a directory to search for documentation rather than a single file.')
	parser.add_argument('-n', '--numbered', action='store_false', default=True, help='Turn off section numbering.')
	parser.add_argument('-c', '--contents', action='store_false', default=True, help='Turn off content sidebar')
	parser.add_argument('-o', '--output', action='store', help='Specifies output filename (or directory if used with -a).')
	args = parser.parse_args()

	DIR = os.path.join(CURRENT_DIR, args.path)

	if args.all:
		SINGLE_FILE = False
	else:
		SINGLE_FILE = True

	DIR = os.path.join(CURRENT_DIR, args.path)

	if args.output:
		MANUAL_OUTPUT = True
		OUTPUT_DIR = os.path.join(CURRENT_DIR, args.output)
	else:
		MANUAL_OUTPUT = False
		OUTPUT_DIR = os.path.join(CURRENT_DIR, args.path)

	CONTENTS = args.contents
	NUMBER_SECTIONS = args.numbered
	MATHS = False

	# Use a temporary CSS file, which can be appended with modifications, so that style customisation easier
	base_css = read_file(os.path.abspath(os.path.join('styles', 'base.css'))) # Baseline CSS
	write_output(base_css, 'temp.css', 'wb')

	# Use to apply a custom skin to the documentation
	# custom_css = read_file(os.path.abspath("rm.css"))
	# write_output(custom_css, 'temp.css')

	CSS = os.path.abspath('temp.css')
	HEADER = os.path.abspath(os.path.join('styles', 'docHeader.html'))
	FONTS = 'Open+Sans Source+Sans+Pro'.split(' ')

def setupFolders():
	if not os.path.exists(OUTPUT_DIR) and not MANUAL_OUTPUT:
		os.makedirs(OUTPUT_DIR)

# Traverse directory structure
def convertFile(root, file):
	if SINGLE_FILE:
		regEx = '(.*)\..*$'
	else:
		regEx = '(.*)\.md$'

	md = re.search(regEx, file, re.IGNORECASE)
	if md:
		filePath = os.path.join(root, file)
		if md.group(1).lower() == 'readme':
			with open(filePath, 'r') as f:
				title = f.readline().strip()
				f.close()
		else:
			title = md.group(1)

		htmlPath = convertMD(root, filePath, title)
		if htmlPath:
			updateTitle(htmlPath, title)
			fontLinks(htmlPath)
			if CONTENTS:
				if not MATHS:
					includeJS(htmlPath, ['jQuery'])
				addContentsNav(htmlPath)
			if MATHS:
				includeJS(htmlPath, ['MathJax'])
				replaceHTML(htmlPath, '<script>$(".math").each(function() { var next = $(this).next(); if (next.prop("tagName") == "BR") {next.remove(); $(this).prev().remove();}});</script></body>', '</body>')


# Update HTML images with binary equivalent
def imageToBinary(html):
	images = re.findall('<img.*\/>', html)
	for i in images:
		source = re.search('src="(.*?)"', i)
		if source:
			imagePath = os.path.join(os.path.dirname(HEADER), source.group(1))
			if os.path.exists(imagePath):
				mimeType = mimetypes.guess_type(imagePath)
				with open(imagePath, 'rb') as f:
					f.seek(0)
					image64 = base64.b64encode(f.read())
				newTag = re.sub('src="(.*?)"', 'src="data:%s;base64,%s"' % (mimeType[0], image64), i)
			else:
				print 'Error: Image file in header cannot be found: %s\n' % imagePath
				sys.exit(1)

		if newTag:
			html = html.replace(i, newTag)
	return html

# Call Pandoc to convert Markdown file
def convertMD(root, markdownFile, title):
	pandocLog=tempfile.NamedTemporaryFile()

	relDir = os.path.dirname(os.path.relpath(markdownFile, DIR)).lower()

	if MANUAL_OUTPUT:
		if SINGLE_FILE:
			htmlFile = OUTPUT_DIR
			htmlPath = OUTPUT_DIR
		else:
			htmlFile = os.path.join(OUTPUT_DIR, title.lower().replace(' ', '-') + '.html')
			htmlPath = os.path.join(OUTPUT_DIR, htmlFile)
			create_folders([os.path.dirname(htmlPath)])
	else:
		htmlFile = os.path.join(root, title.lower().replace(' ', '-') + '.html')
		htmlPath = os.path.join(OUTPUT_DIR, htmlFile)
		create_folders([os.path.dirname(htmlPath)])

	script = ['pandoc', '-s', markdownFile, '-o', htmlPath]

	if CSS:
		script.append('-c')
		script.append(CSS)
	if NUMBER_SECTIONS:
		script.append('--number-sections')
	if CONTENTS:
		script.append('--toc')
	if HEADER:
		with open(HEADER, 'r') as f:
			f.seek(0)
			headerHTML = f.read()

		headerHTML = imageToBinary(headerHTML)

		tempHeader = os.path.join(os.path.dirname(HEADER), 'tempHeader.html')
		with open(tempHeader, 'w') as f:
			f.write(headerHTML)
			f.close()

		script.append('-B')
		script.append(tempHeader)
	else:
		tempHeader = None

	script.append('--self-contained')
	script.append('--highlight-style=haddock')

	print 'Generating HTML file:\t%s...' % os.path.basename(htmlFile)

	with cd(root):
		if sys.platform == 'darwin':
			sh = False
		else:
			sh = True

		p = Popen(script, shell=sh, stdout=pandocLog, stderr=STDOUT)
		p.wait()
		returnCode = p.returncode

	if tempHeader:
		delete_file(tempHeader)

	if returnCode == 0:
		return htmlPath
	else:
		print 'Error:\tMarkdown file could not be converted:\t%s' % markdownFile
		pandocLog.seek(0)
		print pandocLog.read()
		return False

# Update title
def updateTitle(htmlFile, title):
	tag = '<title></title>'
	newTag = '<title>%s</title>' % title
	replaceHTML(htmlFile, newTag, tag)

# Insert Google API font links for fonts specified
def fontLinks(htmlFile):
	metaTag = '<meta name="generator" content="pandoc" />'
	fontHTML = metaTag
	for f in FONTS:
		fontRef = f.replace(' ', '+')
		fontRef = fontRef + ':300,400,400italic,700italic,700'
		fontHTML = fontHTML + '\n<link rel="stylesheet" type="text/css" href="https://fonts.googleapis.com/css?family=%s">' % fontRef

	if len(FONTS) > 0:
		replaceHTML(htmlFile, fontHTML, metaTag)

# Include JS files if necessary
def includeJS(htmlFile, js):
	metaTag = '<meta name="generator" content="pandoc" />'
	jsHTML = metaTag

	# jQuery
	if ('jQuery' in js or 'MathJax' in js):
		jsHTML = jsHTML + '\n<script src="https://ajax.googleapis.com/ajax/libs/jquery/1.11.2/jquery.min.js"></script>'

	# MathJax
	if ('MathJax' in js):
		jsHTML = jsHTML + '\n<script src="https://cdn.mathjax.org/mathjax/latest/MathJax.js?config=TeX-AMS_HTML"></script>'

	replaceHTML(htmlFile, jsHTML, metaTag)

# Update HTML by replacing a known tag
def replaceHTML(htmlFile, newHTML, oldHTML):
	with open(htmlFile, 'r+') as f:
		f.seek(0)
		html = f.read()
		html = html.replace(oldHTML, newHTML)
		f.close()

	with open(htmlFile, 'w') as f:
		f.write(html)
		f.close()

# Add JS to control collapsible contents bar
def addContentsNav(htmlFile):

	placeHolder = 'function loadFunc() {' # Use load function for post processing
	js = placeHolder + '\n\t\t\tvar toggled = false;';
	
	# js += '\n\t\t\t$("table").css("width", "");'
	# js += '\n\t\t\t$("table").children("colgroup").remove();'

	# Build Contents HTML
	js = js + '\n\t\t\t$(".navbar").append(\n\t\t\t\t$("<h2>Contents</h2>").append(\n\t\t\t\t\t$("<span class=\'collapse toggleAll\'>-</span>").click(function() {'
	js = js + '\n\t\t\t\t\t\ttoggleAll(this);\n\t\t\t\t\t})\n\t\t\t\t)\n\t\t\t);\n'

	js = js + '\n\t\t\t$(".navbar").append("<div class=\'search\'><span>Search</span><input></input></div>");';
	js = js + '\n\t\t\t$(".navbar").append($("#TOC"));'
	js = js + '\n\t\t\t$(".canvas, #header").click(function() {\n\t\t\t\tif (toggled) {\n\t\t\t\t\t$(".navbar").animate({width: "0px"}, "fast");'
	js = js + '\n\t\t\t\t\t$(".header_banner").animate({left: "0"}, "fast");\n\t\t\t\t\t$(".canvas").animate({left: "0px"}, "fast");'
	js = js + '\n\t\t\t\t\t$("#header").animate({left: "0px"}, "fast");';
	js = js + '\n\t\t\t\t\t$(".content_button").animate({left: "0px"}, "fast");\n\t\t\t\t\t$(".chevron").text(">");\n\t\t\t\t\ttoggled=false;'
	js = js + '\n\t\t\t\t}\n\t\t\t});'

	# Assign actions to elements
	js = js + '\n\n\t\t\t$(".content_button").click(function() {\n\t\t\t\tif(toggled) {$(".navbar").animate({width: "0px"}, "fast");'
	js = js + '\n\t\t\t\t\t$(".header_banner").animate({left: "0"}, "fast");\n\t\t\t\t\t$(".canvas").animate({left: "0px"}, "fast");'
	js = js + '\n\t\t\t\t\t$("#header").animate({left: "0px"}, "fast");';
	js = js + '\n\t\t\t\t\t$(".content_button").animate({left: "0px"}, "fast");\n\t\t\t\t\t$(".chevron").text(">");\n\t\t\t\t\ttoggled=false;'
	js = js + '\n\t\t\t\t} else {\n\t\t\t\t\t$(".navbar").animate({width: "336px"}, "fast");\n\t\t\t\t\t$(".header_banner").animate({left: "336"}, "fast");'
	js = js + '\n\t\t\t\t\t$(".canvas").animate({left: "336px"}, "fast");\n\t\t\t\t\t$(".content_button").animate({left: "336px"}, "fast");'
	js = js + '\n\t\t\t\t\t$("#header").animate({left: "336px"}, "fast");'
	js = js + '\n\t\t\t\t\t$(".chevron").text("<");\n\t\t\t\t\ttoggled=true;\n\t\t\t\t}\n\t\t\t});\n'

	# Make nav bar sections collapsible
	js = js + '\n\t\t\t$(".navbar").find("a").each(function() {'
	js = js + '\n\t\t\t\tvar list = $(this).next();\n\t\t\t\tif (list.length > 0) {'
	js = js + '\n\t\t\t\t\t$(this).before("<span class=\'toggleList collapse\'>-</span>");'
	js = js + '\n\t\t\t\t\t$(this).prev().click(function() {'
	js = js + '\n\t\t\t\t\t\tif ($(this).hasClass("collapse")) {'
	js = js + '\n\t\t\t\t\t\t\t$(this).text("+").removeClass("collapse");'
	js = js + '\n\t\t\t\t\t\t} else {'
	js = js + '\n\t\t\t\t\t\t\t$(this).text("-").addClass("collapse");'
	js = js + '\n\t\t\t\t\t\t} list.animate({height: \'toggle\'});'
	js = js + '\n\t\t\t\t\t})'
	js = js + '\n\t\t\t\t}'
	js = js + '\n\t\t\t\telse {'
	js = js + '\n\t\t\t\t\t$(this).before("<span class=\'hiddenToggle\'>-</span>");'
	js = js + '\n\t\t\t\t}'
	js = js + '\n\t\t\t});'

	# Implement Search Bar
	js = js + '\n\n\t\t\t$(".navbar .search input").keyup(function() {'
	js = js + '\n\t\t\t\texpandAll();'
	js = js + '\n\t\t\t\tvar val = $(this).val().toLowerCase();'
	js = js + '\n\t\t\t\t$(".navbar a").each(function() {'
	js = js + '\n\t\t\t\t\tvar link = $(this).text().toLowerCase();'
	js = js + '\n\t\t\t\t\tif (link.indexOf(val) >= 0) {'
	js = js + '\n\t\t\t\t\t\t$(this).show(); $(this).prev().show();'
	js = js + '\n\t\t\t\t\t} else {'
	js = js + '\n\t\t\t\t\t\t$(this).hide(); $(this).prev().hide();'
	js = js + '\n\t\t\t\t\t}'
	js = js + '\n\t\t\t\t});'
	js = js + '\n\t\t\t});'

	# Expand/Collapse All functionality
	js = js + '\n\n\t\t\tfunction toggleAll(el) {'
	js = js + '\n\t\t\t\tif ($(el).hasClass(\'collapse\')) {'
	js = js + '\n\t\t\t\t\t$(el).removeClass(\'collapse\');'
	js = js + '\n\t\t\t\t\t$(el).text(\'+\');'
	js = js + '\n\t\t\t\t\tcollapseAll();'
	js = js + '\n\t\t\t\t} else {'
	js = js + '\n\t\t\t\t\t$(el).addClass(\'collapse\');'
	js = js + '\n\t\t\t\t\t$(el).text(\'-\');'
	js = js + '\n\t\t\t\t\texpandAll();'
	js = js + '\n\t\t\t\t}'
	js = js + '\n\t\t\t}\n'
	js = js + '\n\t\t\tfunction collapseAll() {'
	js = js + '\n\t\t\t\t$("ul>li>.toggleList").text(\'+\').removeClass(\'collapse\').nextUntil("ul").next().animate({height: \'hide\'});'
	js = js + '\n\t\t\t}\n'
	js = js + '\n\t\t\tfunction expandAll() {'
	js = js + '\n\t\t\t\t$("ul>li>.toggleList").text(\'-\').addClass(\'collapse\').nextUntil("ul").next().animate({height: \'show\'});'
	js = js + '\n\t\t\t}'

	replaceHTML(htmlFile, js, placeHolder)

	placeHolder = '<div class="header_banner">'
	htmlTags = '<div class="navbar_container">\n<div class="navbar"/>\n</div>'
	htmlTags = htmlTags + '<div class="content_button">\n<div class="chevron">></div>\n</div>'
	htmlTags = htmlTags + '\n' + placeHolder

	replaceHTML(htmlFile, htmlTags, placeHolder)

	replaceHTML(htmlFile, '<div class="canvas">\n<div id="TOC">', '<div id="TOC">')
	replaceHTML(htmlFile, '</div>\n</body>', '</body>')


if __name__ == "__main__":
	init()
	setupFolders()

	if SINGLE_FILE:
		convertFile(os.path.dirname(DIR), os.path.basename(DIR))
	else:
		for root, subDirs, files in os.walk(DIR):
			for file in files:
				convertFile(root, file)

		delete_file(CSS)
		print '\nMarkdown Converter complete.\n'
