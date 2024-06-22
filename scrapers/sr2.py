from bs4 import BeautifulSoup

# Read the HTML content from the saved file
with open('page_content.html', 'r', encoding='utf-8') as file:
    html_content = file.read()

# Parse the HTML using BeautifulSoup
soup = BeautifulSoup(html_content, 'html.parser')

# Find all <div> tags with class="sc-1e6b52c1-1"
divs = soup.find_all('div', class_='sc-1e6b52c1-1')

print(divs)


# Initialize a list to store image URLs
img_urls = []

# Iterate through each <div> tag
for div in divs:
    # Find all <img> tags inside the current <div>
    img_tags = div.find_all('img')
    # Extract the src attribute from each <img> tag and add to img_urls list
    for img in img_tags:
        img_urls.append(img.get('src'))

# Write the image URLs to a text file
with open('img_urls_from_divs.txt', 'w', encoding='utf-8') as file:
    for url in img_urls:
        file.write(url + '\n')

print("Image URLs extracted from <div> elements with class 'sc-1e6b52c1-1' have been successfully written to img_urls_from_divs.txt")
