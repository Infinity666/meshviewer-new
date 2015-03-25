require(["router", "map", "sidebar", "meshstats", "linklist", "simplenodelist", "infobox/main"],
function (Router, Map, Sidebar, Meshstats, Linklist, SimpleNodelist, Infobox) {
  getJSON("config.json").then(main)

  function main(config) {
    var linklist, lostnodeslist, map, meshstats, newnodeslist, router

    function createGUI() {
      moment.locale("de")

      router = new Router(config)

      var linkScale = chroma.scale(chroma.interpolate.bezier(['green', 'yellow', 'red'])).domain([1, 5])
      var sidebar = new Sidebar(document.body)
      var infobox = new Infobox(config, sidebar, router)

      map = new Map(linkScale, sidebar, router)
      document.body.insertBefore(map.div, document.body.firstChild)

      meshstats = new Meshstats()
      newnodeslist = new SimpleNodelist(config, "firstseen", router, "Neue Knoten")
      lostnodeslist = new SimpleNodelist(config, "lastseen", router, "Verschwundene Knoten")
      linklist = new Linklist(linkScale, router)

      sidebar.add(meshstats)
      sidebar.add(newnodeslist)
      sidebar.add(lostnodeslist)
      sidebar.add(linklist)

      router.addTarget(infobox)
      router.addTarget(map)
    }

    var urls = [ config.dataPath + 'nodes.json',
                 config.dataPath + 'graph.json'
               ]

    Promise.all(urls.map(getJSON))
      .then(function (d) { createGUI(); return d })
      .then(handle_data)
      .then(function () { router.loadState(window.location.hash) })

    function handle_data(data) {
      var nodedict = data[0]
      var nodes = Object.keys(nodedict.nodes).map(function (key) { return nodedict.nodes[key] })

      nodes = nodes.filter( function (d) {
        return "firstseen" in d && "lastseen" in d
      })

      nodes.forEach( function(node) {
        node.firstseen = moment.utc(node.firstseen)
        node.lastseen = moment.utc(node.lastseen)
      })

      var now = moment()
      var age = moment(now).subtract(14, 'days')

      var newnodes = limit("firstseen", age, sortByKey("firstseen", nodes).filter(online))
      var lostnodes = limit("lastseen", age, sortByKey("lastseen", nodes).filter(offline))

      var onlinenodes = nodes.filter(online)

      var graph = data[1].batadv
      var graphnodes = data[0].nodes

      graph.nodes.forEach( function (d) {
        if (d.node_id in graphnodes)
          d.node = graphnodes[d.node_id]
      })

      graph.links.forEach( function (d) {
        if (graph.nodes[d.source].node)
          d.source = graph.nodes[d.source]
        else
          d.source = undefined

        if (graph.nodes[d.target].node)
          d.target = graph.nodes[d.target]
        else
          d.target = undefined
      })

      var links = graph.links.filter( function (d) {
        return d.source !== undefined && d.target !== undefined
      })

      links.forEach( function (d) {
        if (!("location" in d.source.node.nodeinfo && "location" in d.target.node.nodeinfo))
          return

        d.latlngs = []
        d.latlngs.push(L.latLng(d.source.node.nodeinfo.location.latitude, d.source.node.nodeinfo.location.longitude))
        d.latlngs.push(L.latLng(d.target.node.nodeinfo.location.latitude, d.target.node.nodeinfo.location.longitude))

        d.distance = d.latlngs[0].distanceTo(d.latlngs[1])
      })

      nodes.forEach( function (d) {
        d.neighbours = []
      })

      links.forEach( function (d) {
        d.source.node.neighbours.push({ node: d.target.node, link: d })
        d.target.node.neighbours.push({ node: d.source.node, link: d })
      })

      map.setData(now, newnodes, lostnodes, onlinenodes, links)
      meshstats.setData(nodes)
      linklist.setData(links)
      newnodeslist.setData(newnodes)
      lostnodeslist.setData(lostnodes)
      router.setData(nodes, links)
    }
  }
})