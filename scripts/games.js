var data = {};

    function initMapInfo(hash) {
        var doMap = function(map) {
        if ('title' in map) {
            var content = $('<a class="link ellipsis" target="_maps">');
            content.attr('href', 'https://resource.openra.net/maps/'+map['id']);
            content.text(map['title']);
            $('.map-'+hash).text('');
            $('.map-'+hash).append(content);
        }
        };

        if (hash in data) {
        doMap(data[hash]);
        return;
        }

        var queryURL = "https://resource.openra.net/map/hash/"+hash;
        $.getJSON(queryURL).done(function(reply) {
        data[hash] = {};
        if (!!reply[0])
            data[hash] = reply[0];

        doMap(data[hash]);
        }).fail(function() {
        $('.map-'+hash).html('Unknown Map');
        });
    }

    function modMetadata(game) {
        // New format mods include the correct metadata already
        if (game['modtitle']) {
        return {
            // Limit title length to avoid breakage
            'title': game['modtitle'].substring(0, 50),
            'icon': game['modicon32'],
            'website': game['modwebsite']
        }
        }
    }

    function parseMasterQuery(masterReply, show_playing, show_waiting, show_empty) {
        var groups = {};
        for (var i in masterReply) {
        game = masterReply[i];

        if (game['mod'] != "hv")
            continue;

        // Filter out unwanted games
        if (game['state'] == 3)
            continue;

        if ((game['state'] == 2) && !show_playing)
            continue;

        if ((game['state'] == 1 && game['players'] > 0) && !show_waiting)
            continue;

        if ((game['players'] == 0) && !show_empty)
            continue;

        var metadata = modMetadata(game);
        var key = [
            game['mod'], game['version'],
            metadata['title'], metadata['icon'], metadata['website']
        ].join('-');

        if (!(key in groups)) {
            metadata['games'] = [];
            metadata['version'] = game['version'];
            metadata['handler'] = 'openra-' + game['mod'] + '-' + game['version'] + '://';
            metadata['players'] = 0;
            groups[key] = metadata;
        }

        groups[key]['players'] += game['players'] + game['spectators'];
        groups[key]['games'].push({
            'name': game['name'].replace(/\\\'/g, "'"),
            'location': game['location'] || 'Unknown',
            'address': game['address'],
            'map': game['map'],
            'state': game['state'],
            'players': game['players'],
            'maxplayers': game['maxplayers'],
            'spectators': game['spectators'],
            'protected': game['protected'],
        });
        }
        return groups;
    }

    function updateGameList() {
        var masterURL = "https://master.openra.net/games?protocol=2&type=json";
        $.getJSON(masterURL, function(masterReply) {
        $('#serverlist').empty();

        var groups = parseMasterQuery(masterReply,
            $('#status_playing').is(':checked'),
            $('#status_waiting').is(':checked'),
            $('#status_empty').is(':checked')
        );

        var ordered = Object.keys(groups).sort(function (a, b) {
            return groups[b]['players'] - groups[a]['players'];
        });

        var hashes = [];
        var activePlayers = 0;
        var activeServers = 0;
        for (var k in ordered) {
            var group = groups[ordered[k]];
            var header = $('<tr>');
            var headerContent = $('<td colspan="6" class="grouprow">');

            if (group['icon']) {
            var content = $('<img width="16" height="16">');
            content.attr('src', group['icon']);
            headerContent.append(content);
            }

            if (group['website']) {
            var content = $('<a class="link" rel="nofollow">');
            content.attr('href', group['website']);
            content.text(group['title']);
            headerContent.append(content);
            } else {
            var content = $('<span>');
            content.text(group['title']);
            headerContent.append(content);
            }

            var versionContent = $('<span style="margin-left:0.5em">');
            versionContent.text('(' + group['version']+')');
            headerContent.append(versionContent);

            if (group['players']) {
            var players = group['players'] == 1 ? 'Player' : 'Players';
            headerContent.append('<span>&nbsp;&mdash;&nbsp;' + group['players'] + '&nbsp;' + players + '</span>');
            }

            // header.append(headerContent)
            $('#serverlist').append(header);

            var gameOrder = Object.keys(group['games']).sort(function (a, b) {
            var ga = group['games'][a];
            var gb = group['games'][b];

            // Sort first by state (waiting, playing, empty)
            if (gb['state'] != ga['state']) {
                // Empty should appear below playing
                if (gb['state'] == 1 && gb['players'] + gb['spectators'] == 0)
                return -1;

                if (ga['state'] == 1 && ga['players'] + ga['spectators'] == 0)
                return 1;

                return ga['state'] - gb['state'];
            }

            // Then by players
            if (gb['players'] != ga['players'])
                return gb['players'] - ga['players'];

            // Finally by name
            return gb['name'] > ga['name'];
            });

            for (var g in group['games']) {
            var game = group['games'][gameOrder[g]];

            activePlayers += game['players'] + game['spectators'];
            activeServers++;
            var state = 'Unknown';
            var stateClass = '';
            switch (game['state']) {
                case 2: state = 'Playing'; stateClass = 'gamePlaying'; break;
                case 1:
                if (game['players'] > 0)
                {
                    state = 'Waiting';
                    stateClass = 'gameWaiting';
                }
                else
                {
                    state = 'Empty';
                    stateClass = 'gameEmpty';
                }
                break;
            }

            var row = $('<tr>');
            var nameCell = $('<td style="text-align: left;">');
            nameCell.attr('title', game['address']);
            var nameContents = $('<span class="ellipsis">');
            nameContents.text(game['name']);
            if (game['protected'])
                nameContents.prepend("&#128274; ");
            nameCell.append(nameContents);
            row.append(nameCell);

            var locationCell = $('<td>');
            var locationContents = $('<span class="ellipsis">');
            locationContents.text(game['location']);
            locationCell.append(locationContents);
            row.append(locationCell);

            var mapCell = $('<td>');
            mapCell.addClass('map-'+game['map']);
            mapCell.text('Loading...');
            row.append(mapCell);

            var players = game['players']+' / '+game['maxplayers'];
            if (game['spectators'] > 0)
                players += ' + ' + game['spectators'];

            row.append('<td>'+players+'</td>');
            row.append('<td><span class="'+stateClass+'">'+state+'</span></td>');

            var joinCell = $('<td>');
            if (game['state'] == 1) {
                var content = $('<a class="link">');
                content.attr('href', group['handler']+game['address']);
                content.text('Join');
                joinCell.append(content);
            }

            row.append(joinCell);
            $('#serverlist').append(row);

            if ($.inArray(game['map'], hashes) < 0)
                hashes.push(game['map']);
            }
        }

        if (activeServers == 0)
            $('#serverlist').append('<tr><td colspan="6">No matching games found</td></tr>');

        for (var i in hashes)
            initMapInfo(hashes[i]);

        $('#activePlayers').text(activePlayers);
        $('#activeServers').text(activeServers);

        window.setTimeout(updateGameList, 30000);
        });
    }

    $(document).ready(function() {
        $('#servercontainer').show();
        $('#serverlist').empty();
        $('#serverlist').append('<tr><td colspan="6">Loading server list...</td></tr>');
        updateGameList();
    });