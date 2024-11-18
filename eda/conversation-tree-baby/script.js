document.addEventListener('DOMContentLoaded', () => {
    let withReplies = []; // Store trees with replies
    let currentPage = 1;
    const postsPerPage = 50;

    // Fetch and process JSON data
    // Fetch and process JSON data
	fetch('11_17_split1-6ctrees.json')
    	.then(response => response.json())
    	.then(data => {
        	withReplies = removeDuplicateTrees(
            	data
                	.filter(tree => tree.Reply_Count > 0)
                	.map(tree => {
                    // Handle NaN in Poster_Id
                    if (!tree.Poster_Id || tree.Poster_Id === 'NaN') {
                        tree.Poster_Id = 'Unknown'; // Replace with 'Unknown' or other placeholder
                    }
                    return tree;
                })
        );

        // Initial render with pagination
        renderTreesWithPagination(withReplies, 'conversation-trees');
    })
    .catch(error => console.error('Error loading JSON:', error));


    document.getElementById('date-filter').addEventListener('change', (event) => {
        const selectedDate = event.target.value;
        const filteredData = filterByDate(withReplies, selectedDate);

        renderTreesWithPagination(filteredData, 'conversation-trees');
    });

    function filterByDate(trees, date) {
        // Ensure the date is valid
        if (!date) return trees;
    
        return trees.filter(tree => {
            const treeDate = new Date(tree.Date);
            const filterDate = new Date(date);
            return treeDate >= filterDate;
        });
    }

    // Sort by Replies
    document.getElementById('sort-replies').addEventListener('click', () => {
        const sortedData = sortByReplies([...withReplies]);
        currentPage = 1; // Reset to first page
        renderTreesWithPagination(sortedData, 'conversation-trees');
    });

    function sortByReplies(trees) {
        return trees.sort((a, b) => b.Reply_Count - a.Reply_Count);
    }

    // Pagination Controls
    document.getElementById('prev-page').addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderTreesWithPagination(withReplies, 'conversation-trees');
        }
    });

    document.getElementById('next-page').addEventListener('click', () => {
        if ((currentPage * postsPerPage) < withReplies.length) {
            currentPage++;
            renderTreesWithPagination(withReplies, 'conversation-trees');
        }
    });

    // Utility Functions

    function removeDuplicateTrees(trees) {
        const seenIDs = new Set();
        return trees.filter(tree => {
            if (seenIDs.has(tree.ID)) return false;
            seenIDs.add(tree.ID);
            return true;
        });
    }

    // Pagination Renderer
    function renderTreesWithPagination(trees, containerId) {
        const container = document.getElementById(containerId);
        container.innerHTML = ''; // Clear the container

        const startIndex = (currentPage - 1) * postsPerPage;
        const endIndex = Math.min(startIndex + postsPerPage, trees.length);

        const paginatedTrees = trees.slice(startIndex, endIndex);
        renderTrees(paginatedTrees, containerId);

        const paginationInfo = document.getElementById('pagination-info');
        paginationInfo.textContent = `Showing ${startIndex + 1} to ${endIndex} of ${trees.length}`;
    }

    // Render Trees
    function renderTrees(trees, containerId) {
        const container = document.getElementById(containerId);
        trees.forEach(tree => {
            const treeElement = document.createElement('div');
            treeElement.className = 'tree';
            createTree(tree, treeElement);
            container.appendChild(treeElement);
        });
    }

    // Create Tree Structure
    function createTree(node, parentElement, depth = 0) {
        const nodeWrapper = document.createElement('div');
        nodeWrapper.className = 'node-wrapper';
        parentElement.appendChild(nodeWrapper);

        if (depth > 0) { // Vertical Line for Hierarchy
            const verticalLine = document.createElement('div');
            verticalLine.className = 'vertical-line';
            nodeWrapper.appendChild(verticalLine);
        }

        // Metadata
        const metadataDiv = document.createElement('div');
        metadataDiv.className = 'metadata';

        const idSpan = document.createElement('span');
        idSpan.textContent = `ID: ${node.ID}`;
        metadataDiv.appendChild(idSpan);

        const posterIdSpan = document.createElement('span');
        posterIdSpan.textContent = `Poster: ${node.Poster_Id}`;
        posterIdSpan.style.marginLeft = '10px';
        metadataDiv.appendChild(posterIdSpan);

        if (node.Date) {
            const dateSpan = document.createElement('span');
            dateSpan.textContent = `Date: ${node.Date}`;
            dateSpan.style.marginLeft = '10px';
            metadataDiv.appendChild(dateSpan);
        }

        const replyCountSpan = document.createElement('span');
        replyCountSpan.textContent = `Replies: ${node.Reply_Count}`;
        replyCountSpan.style.marginLeft = '10px';
        metadataDiv.appendChild(replyCountSpan);

        nodeWrapper.appendChild(metadataDiv);

        // Text Content
        const rawText = node.Text || "No text provided";
        if (rawText === "No text provided" || rawText.trim() === "") return; // Skip if no content

        const cleanRawText = cleanText(rawText);
        const highlightedText = highlightDEI(cleanRawText);
        const censoredText = censorSlurs(highlightedText);

        const truncatedText = document.createElement('span');
        truncatedText.className = depth === 0 ? 'truncated-text root' : 'truncated-text reply';
        truncatedText.innerHTML = censorSlurs(highlightedText);

        const fullTextSpan = document.createElement('span');
        fullTextSpan.className = 'full-text hidden';
        fullTextSpan.innerHTML = censoredText;

        // Expand/Collapse Functionality
        const expandCollapse = document.createElement('span');
        expandCollapse.className = 'expand-collapse';
        expandCollapse.textContent = '>'; // Default to expand indicator

        expandCollapse.addEventListener('click', () => {
            const isExpanded = fullTextSpan.style.display === 'block';
            if (isExpanded) {
                fullTextSpan.style.display = 'none';
                truncatedText.style.display = '-webkit-box';
                expandCollapse.textContent = '>';
                expandCollapse.classList.remove('expanded');
            } else {
                fullTextSpan.style.display = 'block';
                truncatedText.style.display = 'none';
                expandCollapse.textContent = '<';
                expandCollapse.classList.add('expanded');
            }
        });

        // Combine Elements
        const textContainer = document.createElement('div');
        textContainer.className = 'text-container';
        nodeWrapper.insertBefore(expandCollapse, nodeWrapper.firstChild);
        textContainer.appendChild(truncatedText);
        nodeWrapper.appendChild(textContainer);
        nodeWrapper.appendChild(fullTextSpan);

        // Process Replies
        if (node.Replies && Array.isArray(node.Replies) && node.Replies.length > 0) {
            const repliesWrapper = document.createElement('div');
            repliesWrapper.className = 'replies-wrapper';
            nodeWrapper.appendChild(repliesWrapper);

            node.Replies.forEach((child) => {
                createTree(child, repliesWrapper, depth + 1);
            });
        }
    }

    // Utility: Clean Text
    function cleanText(text) {
        if (!text) return "";
        return text.replace(/\\n/g, ' ').trim(); // Replace \n with space and trim
    }

    // Utility: Highlight DEI Terms
    function highlightDEI(text) {
        const regex = /\b(\w+)?\s*(DEI)\s*(\w+)?\b/gi;
        return text.replace(regex, (match, before, dei, after) => {
            let result = '';
            if (before) result += `<span class="highlight">${before}</span> `;
            result += `<span class="highlight">${dei}</span>`;
            if (after) result += ` <span class="highlight">${after}</span>`;
            return result;
        });
    }

    // Utility: Censor Slurs
    function censorSlurs(text) {
        const slurs = [
            "nigger", "spic", "chink", "kike", "gook",
            "fag", "dyke", "niggers", "nigga", "niggas", "kikes"
        ];
        const regex = new RegExp(`\\b(${slurs.join('|')})\\b`, 'gi');
        return text.replace(regex, (match) => match.replace(/[aeiou]/gi, '*'));
    }
});

















