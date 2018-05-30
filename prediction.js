let margin = {top: 30, right: 10, bottom: 10, left: 10};
let width = 1200 - margin.left - margin.right;
let halfWidth = width / 2;
let height = 600 - margin.top - margin.bottom;
let i = 0;
let duration = 500;
let root;

const getChildren = (d) => {
    let i;
    const a = [];
    if (d.winners) for (i = 0; i < d.winners.length; i++) {
        d.winners[i].isRight = false;
        d.winners[i].parent = d;
        a.push(d.winners[i]);
    }
    if (d.challengers) for (i = 0; i < d.challengers.length; i++) {
        d.challengers[i].isRight = true;
        d.challengers[i].parent = d;
        a.push(d.challengers[i]);
    }
    return a.length ? a : null;
};

const tree = d3.layout.tree().size([height, width]);

const calcLeft = (d) => {
    let l = d.y;
    if (!d.isRight) {
        l = d.y - halfWidth;
        l = halfWidth - l;
    }
    return {x: d.x, y: l};
};
const elbow = (d) => {
    const source = calcLeft(d.source);
    const target = calcLeft(d.target);
    let hy = (target.y - source.y) / 2;
    if (d.isRight) hy = -hy;
    return "M" + source.y + "," + source.x
        + "H" + (source.y + hy)
        + "V" + target.x + "H" + target.y;
};
const connector = elbow;

const vis = d3
    .select("#chart")
    .append("svg")
    .attr("width", width + margin.right + margin.left)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

d3.json("./prediction.json", (json) => {
    root = json;
    root.x0 = height / 2;
    root.y0 = width / 2;

    const t1 = d3.layout.tree().size([height, halfWidth]).children((d) => {
            return d.winners;
        }),
        t2 = d3.layout.tree().size([height, halfWidth]).children((d) => {
            return d.challengers;
        });
    t1.nodes(root);
    t2.nodes(root);

    const rebuildChildren = (node) => {
        node.children = getChildren(node);
        if (node.children) node.children.forEach(rebuildChildren);
    };
    rebuildChildren(root);
    root.isRight = false;
    update(root);
});

const toArray = (item, arr) => {
    arr = arr || [];
    let i = 0, l = item.children ? item.children.length : 0;
    arr.push(item);
    for (; i < l; i++) {
        toArray(item.children[i], arr);
    }
    return arr;
};

const update = (source) => {
    // Compute the new tree layout.
    const nodes = toArray(source);

    // Toggle children on click.
    const click = (d) => {
        if (d.children) {
            d._children = d.children;
            d.children = null;
        } else {
            d.children = d._children;
            d._children = null;
        }
        update(source);
    };

    // Normalize for fixed-depth.
    nodes.forEach((d) => {
        d.y = d.depth * 180 + halfWidth;
    });

    // Update the nodes…
    const node = vis.selectAll("g.node")
        .data(nodes, (d) => {
            return d.id || (d.id = ++i);
        });

    // Enter any new nodes at the parent's previous position.
    const nodeEnter = node.enter().append("g")
        .attr("class", "node")
        .attr("transform", () => {
            return "translate(" + source.y0 + "," + source.x0 + ")";
        })
        .on("click", click);

    nodeEnter.append("svg:image")
        .attr("xlink:href", d => d.img)
        .attr("x", () => -20)
        .attr("y", () => -15)
        .attr("height", 30)
        .attr("width", 40);

    nodeEnter.append("text")
        .attr("dy", d => 25)
        .attr("text-anchor", "middle")
        .text(d => d.name)
        .style("fill-opacity", 1e-6);

    // Transition nodes to their new position.
    const nodeUpdate = node.transition()
        .duration(duration)
        .attr("transform", (d) => {
            p = calcLeft(d);
            return "translate(" + p.y + "," + p.x + ")";
        })
    ;

    nodeUpdate.select("circle")
        .attr("r", 4.5)
        .style("fill", (d) => {
            return d._children ? "lightsteelblue" : "#fff";
        });

    nodeUpdate.select("text")
        .style("fill-opacity", 1);

    // Transition exiting nodes to the parent's new position.
    const nodeExit = node.exit().transition()
        .duration(duration)
        .attr("transform", (d) => {
            p = calcLeft(d.parent || source);
            return "translate(" + p.y + "," + p.x + ")";
        })
        .remove();

    nodeExit.select("circle")
        .attr("r", 1e-6);

    nodeExit.select("text")
        .style("fill-opacity", 1e-6);

    // Update the links...
    const link = vis.selectAll("path.link")
        .data(tree.links(nodes), (d) => {
            return d.target.id;
        });

    // Enter any new links at the parent's previous position.
    link.enter().insert("path", "g")
        .attr("class", "link")
        .attr("d", () => {
            const o = {x: source.x0, y: source.y0};
            return connector({source: o, target: o});
        });

    // Transition links to their new position.
    link.transition()
        .duration(duration)
        .attr("d", connector);

    // Transition exiting nodes to the parent's new position.
    link.exit().transition()
        .duration(duration)
        .attr("d", (d) => {
            const o = calcLeft(d.source || source);
            if (d.source.isRight) o.y -= halfWidth - (d.target.y - d.source.y);
            else o.y += halfWidth - (d.target.y - d.source.y);
            return connector({source: o, target: o});
        })
        .remove();

    // Stash the old positions for transition.
    nodes.forEach((d) => {
        const p = calcLeft(d);
        d.x0 = p.x;
        d.y0 = p.y;
    });
};
