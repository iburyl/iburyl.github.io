// Small DOM building helpers for the date range report. No dependencies.

window.IR = window.IR || {};

(function (IR) {
    // Minimal element factory.
    //   props: { class, html, text, <attr> }
    //   children: Node | string | (Node|string|null)[]
    IR.el = function (tag, props, children) {
        const node = document.createElement(tag);
        if (props) {
            Object.keys(props).forEach((k) => {
                if (k === 'class') node.className = props[k];
                else if (k === 'html') node.innerHTML = props[k];
                else if (k === 'text') node.textContent = props[k];
                else node.setAttribute(k, props[k]);
            });
        }
        if (children != null) {
            (Array.isArray(children) ? children : [children]).forEach((c) => {
                if (c == null) return;
                node.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
            });
        }
        return node;
    };

    // A table cell. Accepts a Node, an { html } object, or a plain value.
    function cell(tag, value) {
        const td = document.createElement(tag);
        if (value instanceof Node) td.appendChild(value);
        else if (value && typeof value === 'object' && 'html' in value) td.innerHTML = value.html;
        else td.textContent = value == null ? '' : String(value);
        return td;
    }

    // Build a <table> from a header array and an array of row arrays.
    IR.table = function (headers, rows, className) {
        const table = IR.el('table', className ? { class: className } : null);

        const thead = document.createElement('thead');
        const htr = document.createElement('tr');
        headers.forEach((h) => htr.appendChild(cell('th', h)));
        thead.appendChild(htr);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        rows.forEach((r) => {
            const tr = document.createElement('tr');
            r.forEach((c) => tr.appendChild(cell('td', c)));
            tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        return table;
    };

    IR.link = function (href, text) {
        return { html: `<a href="${href}" target="_blank" rel="noopener">${text}</a>` };
    };

    IR.image = function (src, href, size) {
        if (!src) return '';
        const img = `<img src="${src}" alt="" width="${size || 75}">`;
        return { html: href ? `<a href="${href}" target="_blank" rel="noopener">${img}</a>` : img };
    };

    // Section heading with a small "copy" affordance that copies HTML produced by
    // getHtml() to the clipboard.
    IR.titleWithCopy = function (titleText, getHtml) {
        const title = IR.el('h2', null, [
            IR.el('span', { text: titleText }),
        ]);
        const copy = IR.el('span', {
            class: 'copy-link', text: ' (copy)', title: 'Copy HTML to clipboard',
        });
        copy.addEventListener('click', () => {
            const html = getHtml();
            if (!html) return;
            navigator.clipboard.writeText(html).then(() => {
                const prev = copy.textContent;
                copy.textContent = ' \u2713';
                setTimeout(() => { copy.textContent = prev; }, 1000);
            }).catch((err) => console.error('Copy failed', err));
        });
        title.appendChild(copy);
        return title;
    };

    // Concatenate every "<h3> + <table>" group carrying `groupClass`, for copying.
    IR.collectGroupsHtml = function (root, groupClass) {
        const tables = root.querySelectorAll('.' + groupClass);
        let html = '';
        tables.forEach((table) => {
            const h3 = table.previousElementSibling;
            if (h3 && h3.tagName === 'H3') html += h3.outerHTML + '\n';
            html += table.outerHTML + '\n';
        });
        return html || null;
    };
})(window.IR);
