#!usr/bin/env python
#
# Script to modify JSDoc HTML output to enhance features
#
# Author: Minesh Patel (Rittman Mead)
#

# Standard Python distribution libraries
import os, sys, argparse, re
from lxml import etree as ET # Used for parsing XML structures

try:
	# rm_sys.os.chdir(rm_sys.SCRIPT_DIR) # Change to script directory

	global SCRIPT_DIR, CURRENT_DIR
	SCRIPT_DIR = os.path.abspath(os.path.dirname(sys.argv[0]))
	CURRENT_DIR = os.getcwd()

	# ArgumentParser to parse arguments and options
	parser = argparse.ArgumentParser(description="Rittman Mead JSDoc Converter")
	parser.add_argument("doc",action="store",help="JSDoc HTML document to format.")
	parser.add_argument("-o", "--output", action="store", default="", help="Override for output location. If unspecified, will overwrite")

	args = parser.parse_args()
	DOC = os.path.join(CURRENT_DIR, args.doc)
	if (args.output):
		OUTPUT = os.path.join(CURRENT_DIR, args.output)
	else:
		OUTPUT = DOC

except Exception as err:
	print '\n\nException caught:\n\n%s ' % (err)
        print '\n\tError: Failed to get command line arguments. Exiting.'
        sys.exit(1)

# Read file
def readFile(filename):
	with open(filename, 'r') as f:
		f.seek(0)
		output = f.read()
		f.close()
	return output

# Write to files
def writeFile(line, filename, mode='a'):
	with open(filename,mode) as output:
		line = line.encode('utf-8')
		output.write('%s\n' % line)
		output.close()

# Cleanup HTML so LXML can read it
def cleanupHTML(html):
	links = re.findall('<link (.*?)>', html)
	for l in links:
		html = html.replace('<link %s>' % l, '<link %s />' % l)

	html = html.replace('<br class="clear">', '<br class="clear" />')
	html = html.replace('<br>', '<br />')
	html = html.replace('<meta charset="utf-8">', '<meta charset="utf-8" />')
	html = html.replace('&rarr;', '~!rightArrow!~')
	html = html.replace(']]', '?!]!??!]!?')

	return html

# Pretty prints XML string
def prettyPrintXML(tree):
	parser = ET.XMLParser(remove_blank_text=True)
	xml = ET.tostring(tree.getroot(), pretty_print=True) # Convert to string
	elem = ET.XML(xml, parser=parser)
	xml = ET.tostring(elem, pretty_print=True)
	return xml

# Get headings
def addLinks(root, type, prefix):
	list = []
	for el in root.xpath('.//h4[preceding-sibling::h3[1] = "%s"]' % type):
		id = el.attrib["id"]
		if (id[0] == '.'):
			id = id[1:len(id)]
		list.append(id)

	nav = root.find('.//nav')

	if len(list) > 0:
		heading = ET.SubElement(nav, "h3")
		heading.text = type
		ul = ET.SubElement(nav, 'ul')
		for link in list:
			li = ET.SubElement(ul, 'li')
			li.insert(len(li), ET.XML('<a href="#%s%s">%s</a>' % (prefix, link, link)))

def cleanupXML(xml):
	xml = xml.replace('~!rightArrow!~', '&rarr;') # Replace escaped characters
	xml = xml.replace('?!]!??!]!?', ']]')
	xml = xml.replace('&gt;', '>')
	xml = xml.replace('jsdoc-default.css', 'insights-doc.css')
	return xml

def genJS():
	js = '\n\t\t\tdocument.getElementsByTagName("body")[0].style.display = "none";'
	js += '\n\n\t\t\tfunction loadFunc() {'
	js += '\n\n\t\t\t$(".navbar .search input").keyup(function() {'
	js += '\n\t\t\t\texpandAll();'
	js += '\n\t\t\t\tvar val = $(this).val().toLowerCase();'
	js += '\n\t\t\t\t$(".navbar li>a").each(function() {'
	js += '\n\t\t\t\t\tvar link = $(this).text().toLowerCase();'
	js += '\n\t\t\t\t\tif (link.indexOf(val) >= 0) {'
	js += '\n\t\t\t\t\t\t$(this).show();'
	js += '\n\t\t\t\t\t} else {'
	js += '\n\t\t\t\t\t\t$(this).hide();'
	js += '\n\t\t\t\t\t}'
	js += '\n\t\t\t\t});'
	js += '\n\t\t\t});'

	js += '\n\t\t\t$("nav h3").click(function(){'
	js += '\n\t\t\t\t$(this).next().animate({ height: "toggle" });'
	js += '\n\t\t\t\tif ($(this).find(".toggleList").hasClass("collapse")) {'
	js += '\n\t\t\t\t\t$(this).find(".toggleList").removeClass("collapse");'
	js += '\n\t\t\t\t\t$(this).find(".toggleList").text("+");'
	js += '\n\t\t\t\t} else {'
	js += '\n\t\t\t\t\t$(this).find(".toggleList").addClass("collapse");'
	js += '\n\t\t\t\t\t$(this).find(".toggleList").text("-");'
	js += '\n\t\t\t\t}'
	js += '\n\t\t\t});'

	js += '\n\n\t\t\tfunction collapseAll() {'
	js += '\n\t\t\t\t$(".toggleList").text("+").removeClass("collapse").parent().next().animate({height: "hide"});'
	js += '\n\t\t\t}'

	js += '\n\n\t\t\tfunction expandAll() {'
	js += '\n\t\t\t\t$(".toggleList").text("-").addClass("collapse").parent().next().animate({height: "show"});'
	js += '\n\t\t\t}'

	js += '\n\n\t\t\tdocument.getElementsByTagName("body")[0].style.display = "block";'
	js += '\n}'
	js += '\n\nwindow.onload = loadFunc;'
	return js

def processDoc(file, output):
	if '.' in os.path.basename(os.path.splitext(file)[0]):
		prefix = ''
	else:
		prefix = '.'

	doc = readFile(file)
	doc = cleanupHTML(doc)

	tree = ET.ElementTree(ET.fromstring(doc))
	root = tree.getroot()

	# Remove parameter type lists
	# for pt in root.findall('.//dd/span[@class="param-type"]'):
		# parent = pt.getparent().getparent();
		# parent.getparent().remove(parent);

	# Remove the footer (with generation time)
	footer = root.find('.//footer')
	footer.getparent().remove(footer);

	# Change title
	title = root.find('.//title')
	title.text = 'Insights API'

	# Add horizontal rules between members and methods
	for h4 in root.findall('.//h4'):
		parent = h4.getparent()
		idx = parent.index(h4)
		parent.insert(idx, ET.XML("<hr />"))

	# Convert See text to hyperlinks
	for see in root.findall('.//dd[@class="tag-see"]/ul/li'):
		link = see.text
		see.insert(0, ET.XML('<a href="#%s%s">%s</a>' % (prefix, link, link)))
		see.text = ''

	# Find member sections
	members = addLinks(root, 'Members', prefix)
	methods = addLinks(root, 'Methods', prefix)

	nav = root.find('.//nav')

	navbar = ET.XML('<div> </div>')
	navbar.attrib['class'] = 'navbar'
	for el in nav:
		navbar.append(el)
	navbar.insert(1, ET.XML('<div class="search"><span>Search</span><input /></div>'))
	nav.insert(0, navbar)

	headers = navbar.findall('.//h3')
	for h3 in headers:
		h3.append(ET.XML('<span class="toggleList collapse">-</span>'))

	main = root.find('.//div[@id="main"]')
	main.insert(0, ET.XML('<div class="header-banner"> </div>'))

	title = root.find('.//h1')
	header = root.find('.//div[@class="header-banner"]')
	header.insert(0, title)
	header.append(ET.XML('<a class="homeBtn" href="/insights/docs"><i class="fa fa-home"> </i></a>'))

	head = root.find('.//head')
	head.insert(len(head), ET.XML('<script src="/insights/js/lib/jquery.min.js"> </script>'))
	head.insert(len(head), ET.XML('<link type="text/css" rel="stylesheet" href="/insights/icons/css/font-awesome.min.css" />'))

	script = ET.XML('<script> </script>')
	script.attrib["type"] = 'text/javascript'
	script.text = genJS()

	root.find('body').insert(0, script)

	outputXML = prettyPrintXML(tree)
	outputXML = cleanupXML(outputXML)

	writeFile(outputXML, output, mode='w')

def main():
	# Check if input is a file or directory. If the latter, process all HTML files found
	if os.path.isfile(DOC):
		processDoc(DOC, OUTPUT)
	else:
		for root, subDirs, files in os.walk(DOC):
			for file in files:
				regEx = '(.*)\.html$'
				type = re.search(regEx, file, re.IGNORECASE)

				if type:
					fullPath = os.path.join(root, file)
					processDoc(fullPath, fullPath)

	print('\nFinished modifying JSDocs')


if __name__ == "__main__":
	main()
