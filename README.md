# webcodex
A set of functions to collect data and metrics from websites.

## Architecture
The idea behind all functions are to act as thin layers to accommodate some input parameters, do some action and transform the result to satify some output (or to have a specific side-effect, like daily functions). Most of the functions are designed to focus on a single metric but there are few expections (like the color detection).
### HTTP functions

<p align="center">
  <img width="750" src="https://imgur.com/N6wjNwk.png">
</p>

### Daily functions
These functions are persisting the metrics into DynamoDB and are triggered by an SNS message originated externally.
<p align="center">
  <img width="750" src="https://imgur.com/2DheX42.png">
</p>

## Project structure
There are two important types of functions included in this project: functions that run on a daily basis and functions that are triggered by HTTP requests. The goal is to be able to re-use as much shared logic as possible between these two different types. The `utils` module is where the shared logic between these two live. In order to bundle just the dependencies needed for a given function the project uses Webpack and defines the necessary imports on a per-function basis, passing these dependencies back to the `utils` module.

## Metrics
### Colors defined in the CSS
To get the data for this metric a request is made to the website and all the stylesheets are aggregated. After that, the following  regular expression is used to match hexadecimal (e.g. both `#AAA` and `#AAAAAA), rgb and hsla definitions:
```
/(#([\da-f]{3}){1,2}|(rgb|hsl)a\((\d{1,3}%?,\s?){3}(1|0?\.\d+)\)|(rgb|hsl)\(\d{1,3}%?(,\s?\d{1,3}%?){2}\))/ig
```
Finally after the list of colors is obtained the list is sorted using [color-sorter](https://github.com/bartveneman/color-sorter).

### Color detection
This function uses a headless browser to capture a screenshot and utilizes imagemagick to extract predominant colors from a 50x50 matrix.
### HTML
This function traverses the DOM tree and aggregates into DOM elements frequency and attributes frequency.
### CSS
The function first tries to retrieve the CSS content of the website using [axios]() and if that fails then retries using cURL with an specific set of headers (due to browser fringerprinting). After getting the whole CSS content of the website the function uses Project Wallace's [css-analyzer](https://github.com/projectwallace/css-analyzer) to get the CSS metrics.
### HTTP Headers
The purpose of this function is to collect the HTTP headers using cURL.
### Lighthouse
The function spins a headless browser to then connect Lighthouse to it and run basic audits. After getting the results back, it uploads the results to Github's gists and returns the 
### Technologies detection
The function focuses on identifyng libraries or frameworks that are loaded in a website. To achieve this, the function runs a headless browser and collects all the `<script>` links **after the website is fully loaded**. Once the complete list of JS resources is obtained the function downloads every resource, concatenates them and finds matches with regular expressions.

Why not use cheerio for that? Some popular websites started modifying the `<head>` element dynamically adding JavaScript bundles on-the-fly, making the task of grouping all the JS resources while not "running" any JavaScript within cheerio very difficult.


## Utility functions
### Convert-images
The function is built to convert screenshot images from PNG format to webp (and crops the image too) so that an up-to-date screenshot for every designated website is easily accessed.
### Optimize image
The function can receive an image url and will return the same image converted to webp format in a base64 encoding format.

## Data store
The metrics collected daily are being stored in DynamoDB. Every update to DynamoDB is designed to replace data at the property level, in a way similar to what an update with `:set` in MongoDB would do.

## Next steps
There is a low percentage of errors on current executions and although the project does not aim to be able to target 100% of the websites out there, it would be good to know why those failures happen and where is the limitation.