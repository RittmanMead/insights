# Converts list of fonts from https://fortawesome.github.io/Font-Awesome/cheatsheet/ to JSON
# Copy the full list of icons into a text file from that page and process it into JSON using this script
import os
import re, argparse

def write_output(line, filename, mode='a'):
	with open(filename,mode) as output:
		line = line.encode('utf-8')
		output.write('%s\n' % line)
		output.close()

def read_file(filename):
	with open(filename, 'r') as f:
		f.seek(0)
		output = f.read()
		f.close()
	return output
	
if __name__ == "__main__":
	raw_icons = read_file('icons.txt')
	icons = re.findall('fa-(.*?) ', raw_icons)
	json = '{\n\t"icons": [\n\t\t"'
	json += '",\n\t\t"'.join(icons)
	json += '"\n\t]\n}'
	write_output(json, 'icons.json', 'wb')