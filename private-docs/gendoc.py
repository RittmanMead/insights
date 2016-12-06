import os
import sys
import subprocess
from os import path

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

# Create a directory if it doesn't exist
def create_dir(dir):
	if not path.exists(dir):
		os.makedirs(dir)

# Read first line of a file
def read_first_line(filename):
	with open(filename, 'r') as f:
		first_line = f.readline()
	return first_line

MAIN_DIR = path.join(path.abspath(path.dirname(sys.argv[0])), os.pardir)
js1 = path.join(MAIN_DIR, 'js', 'obiee.js')
js2 = path.join(MAIN_DIR, 'js', 'insights.js')
js3 = path.join(MAIN_DIR, 'js', 'rmvpp.js')
js4 = path.join(MAIN_DIR, 'js', 'config.js')
opt = path.join(MAIN_DIR, 'docs', 'api')
parsePlugins = path.join(MAIN_DIR, 'private-docs', 'parsePlugins.js')
converter = path.join(MAIN_DIR, 'private-docs', 'md_to_html.py')

jsdoc = "jsdoc %s %s  %s %s -d %s" % (js1, js2, js3, js4, opt)
mod_doc = "python %s %s" % (path.join(MAIN_DIR, 'docs', 'api', 'scripts', 'mod_doc.py'), path.join(MAIN_DIR, 'docs', 'api'))

print('\nGenerating general documentation...')
MD_DIR = path.join(MAIN_DIR, 'private-docs', 'markdown')
DOC_DIR = path.join(MAIN_DIR, 'docs')

# Reset index file
index_file = path.join(MD_DIR, 'Index.md')
write_output('% Documentation\n\n', index_file, 'wb')

docs, bugs, user, tuts = [], [], [], []

for root, subDirs, files in os.walk(MD_DIR):
	folder = root.replace(MD_DIR+'/', '').replace(MD_DIR+'\\', '').replace(MD_DIR,'')
	out_folder = path.join(DOC_DIR, folder)
	create_dir(out_folder)

	for file in files:
		if file.endswith('.md') and file != 'Index.md': # Convert if it's a markdown file
			out_file = file.lower().replace(' ', '-').replace('.md', '.html')
			if (folder):
				link = folder.replace('\\','/') + '/' + out_file
			else:
				link = out_file

			if (folder not in ['bugs', 'user', 'tutorials']):
				docs.append({ 'file' : file.replace('.md', ''), 'link' : link})
			elif folder == 'bugs':
				bugs.append({'file' : file.replace('.md', ''), 'link' : link})
			elif folder == 'user':
				user.append({'file' : file.replace('.md', ''), 'link': link})
			elif folder == 'tutorials':
				tuts.append({'file' : file.replace('.md', ''), 'link': link})

			if folder =='tutorials':
				md_to_html = 'python "%s" "%s" -o "%s" -c' % (converter, path.join(root, file), path.join(out_folder, out_file))
			else:
				md_to_html = 'python "%s" "%s" -o "%s"' % (converter, path.join(root, file), path.join(out_folder, out_file))
			subprocess.call(md_to_html, shell=True)

user.append({'file' : 'Plugins', 'link' : 'plugins'})
docs.append({'file' : 'API Reference', 'link' : 'api'})

# Sort by the number before dash in the title
def numeric_sort(x):
	return int(x['file'].split(' - ')[0])

docs = sorted(docs)
bugs = sorted(bugs)
user = sorted(user)
tuts = sorted(tuts, key=numeric_sort)

write_output('\n### User\n', index_file)
for doc in user:
	string = '* #### [%s](%s)' % (doc['file'], doc['link'])
	write_output(string, index_file)

write_output('\n### Tutorials\n', index_file)
for doc in tuts:
	string = '* #### [%s](%s)' % (doc['file'], doc['link'])
	write_output(string, index_file)

write_output('\n### Technical\n', index_file)
for doc in docs:
	string = '* #### [%s](%s)' % (doc['file'], doc['link'])
	write_output(string, index_file)

write_output('\n### Bugs and Limitations\n', index_file)
for doc in bugs:
	string = '* #### [%s](%s)' % (doc['file'], doc['link'])
	write_output(string, index_file)

md_to_html = 'python "%s" "%s" -n -c -o %s' % (converter, index_file, path.join(MAIN_DIR, 'docs', 'index.html'))
subprocess.call(md_to_html, shell=True)


print('\nGenerating API documentation with JS Doc...')
subprocess.call(jsdoc, shell=True) # JSDoc generation
subprocess.call(mod_doc, shell=True) # Style the JS Doc

# Generate plugin documentation for available plugins
print('\nCreating plugin documentation...')
subprocess.call(['node', parsePlugins], shell=True)
plugins_dir = path.join(MAIN_DIR, 'docs', 'plugins')
create_dir(plugins_dir)
write_output('% Plugin Index\n\n', 'plugin-index.md', 'wb')
for root, subDirs, files in os.walk(path.join(MAIN_DIR, 'plugins')):
    if 'doc.md' in files: # If document found
		src = path.join(root, 'doc.md')
		out = path.join(MAIN_DIR, 'docs', 'plugins', path.basename(root) + '.html')

		title = read_first_line(src)
		link = '* #### [%s](%s)' % (title.replace('% ', ''), path.basename(root) + '.html')
		write_output(link, 'plugin-index.md') # Write to index

		script = "python %s %s -o %s -n" % (converter, src, out)
		subprocess.call(script, shell=True)
		os.remove(src)

# Generate plugin index file
script = "python %s %s -o %s -n -c" % (converter, 'plugin-index.md', path.join(plugins_dir, 'index.html'))
subprocess.call(script, shell=True)
os.remove('plugin-index.md')
os.remove(path.join(MAIN_DIR, 'private-docs', 'temp.css'))
