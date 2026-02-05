<?php session_start(); 
?>
<!DOCTYPE html>
<html lang="en">
	<head>
		<meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
		<title>Thinkertools history</title>
		<link rel="stylesheet" href="main.css" content="text/html; charset=utf-8"/>
		<!-- main head and dropdown menu -->
		<meta name="viewport" content="width=device-width, initial-scale=1">
		<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
		<link rel="stylesheet" href="mainhead.css" content="text/html; charset=utf-8"/>
		<link rel="stylesheet" href="quipx/qx.css" content="text/html; charset=utf-8"/>
	</head>
	<body>
		<div class="container">
			<?php
				require('mainhead.php');
				if (!isset($_SESSION['userID'])) {
					print '
					<div class="column">
						<div class="toolbox login">
							<a href="login.php" class="toollink">Log in to see history</a>
						</div>
					</div>';
				}
				else {
					print '
					<div class="column">
						<div class="toolbox woi" style="margin-top:24px">
							<a href="webofinquiry/home.php" class="toollink">Web of Inquiry</a>
						</div>';
							print '
							<form action="history.php?action=game" class="form" style="margin-top:12px" method="post">
							<select name="game_id" class="inputtext" style="width:100%; height:40px;">';
							require('accountsdb.php');
							$getTeams = "SELECT teamID FROM ttteam_mem WHERE userID =?";
        					$teams = $mysqli->execute_query($getTeams, [$_SESSION['userID']])->fetch_all(MYSQLI_ASSOC);
							foreach($teams as $team) {
								foreach($team as $team_key => $teamID){
									require('webofinquiry/woidb.php');
							    	$getGames = "SELECT game_id, game_name FROM game WHERE teamID =? ORDER BY game_id DESC";
							    	$games = $mysqli->execute_query($getGames, [$teamID])->fetch_all(MYSQLI_ASSOC);
							    	if (!empty($games)) {
							    		foreach($games as $game_key => $game) {
							    			print '<option value='.$game["game_id"].'>'.stripslashes($game["game_name"]).'</option>';
							    		}
							    	}
							    }
							}
							print '</select>
							<input type="submit" name="submit" class="submitbutton" style="margin-top:12px" value="Open" />
							</form>';
						print '
						<div class="toolbox quipx" style="margin-top: 36px">
							<a href="quipx/home.php" class="toollink">Quipx</a>
						</div>';
						print '
						<form action="history.php?action=session" class="form" style="margin-top:12px" method="post">
						<select name="sessionID" class="inputtext" style="width:100%; height:40px;">';
						require('accountsdb.php');
						$getTeams = "SELECT teamID FROM ttteam_mem WHERE userID =?";
    					$teams = $mysqli->execute_query($getTeams, [$_SESSION['userID']])->fetch_all(MYSQLI_ASSOC);
						foreach($teams as $team) {
							foreach($team as $team_key => $teamID){
								require('quipx/qxdb.php');
						    	$getSessions = "SELECT sessionID, subject FROM session WHERE teamID=?";
							    $sessions = $mysqli->execute_query($getSessions, [$teamID])->fetch_all(MYSQLI_ASSOC);
							    if (!empty($sessions)) {
									foreach($sessions as $session_key => $session){
						    			print '<option value='.$session["sessionID"].'>'.stripslashes($session["subject"]).'</option>';
						    		}
						    	}
						    }
						}
						print '</select>
						<input type="submit" name="submit" class="submitbutton" style="margin-top:12px" value="Open" />
						</form>';
					print '</div>';
					// display game or session 
					print '<div class="column">';
						if (isset($_GET['action']) && isset($_SESSION['userID'])) {
							print '<div class="contentbox" style="width:650px">';
								if ($_GET['action'] == "game") {
									// game info
									require "webofinquiry/woidb.php";
									$getGame = "SELECT * FROM game WHERE game_id=?";
									$game = $mysqli->execute_query($getGame, [$_POST['game_id']])->fetch_assoc();
									$game_name = stripslashes($game['game_name']);	
									$game_description = stripslashes($game['game_description']);
									$game_template = $game['template_id'];
									$game_creator = $game['game_creator'];
									$game_public = $game['game_public'];
									print '<strong>Inquiry question or topic</strong><br />'; echo $game_name; print '<br />';
									echo $game_description;
									print '<br /><br />';
									// team 
									require('accountsdb.php');
									$getTeamName = "SELECT teamName FROM ttteam WHERE teamID=?";
									$name = $mysqli->execute_query($getTeamName, [$teamID])->fetch_assoc();
									print '<strong>Team</strong><br />'; echo stripslashes($name['teamName']); 
									print '<br /><br />';
									// current status
									require "webofinquiry/woidb.php";
									$getTurnTextID = "SELECT turn_id FROM turn WHERE game_id=? ORDER BY turn_id DESC LIMIT 1";
									$turnID = $mysqli->execute_query($getTurnTextID, [$_POST['game_id']])->fetch_assoc();
									if (!empty($turnID)) {
										$turn_id = $turnID['turn_id'];
										$getTurnText = "SELECT turn_text FROM turn_text WHERE turn_id=?";
										$turnText = $mysqli->execute_query($getTurnText, [$turn_id])->fetch_assoc();
										print '<strong>Current game status</strong><br />';
										echo stripslashes($turnText['turn_text']); // print '<br /><br />';
									}
									//template
									$getTemplate = "SELECT template_name, template_object FROM template WHERE template_id=?";
									$template = $mysqli->execute_query($getTemplate, [$game_template])->fetch_assoc();
									print '<strong>Game name and object</strong><br />';
							  		echo stripslashes($template['template_name']);
							  		print '<br />';
							  		echo stripslashes($template['template_object']);
							  		print '<br /><br /><strong>Rules</strong> <br />';
							  		$getRules = "SELECT rule, rule_order FROM template_rule WHERE template_id=?";
							  		$rules = $mysqli->execute_query($getRules, [$game_template])->fetch_all(MYSQLI_ASSOC);
							  		foreach($rules as $rule_key => $rule) {
							  			if ($rule['rule'] != "") {
									  		echo $rule['rule_order']; print '. ';
									  		echo stripslashes($rule['rule']); print '<br />';
									  	}
							  		}
									print '<br /><strong>Moves</strong><br />';
							  		$getMoves = "SELECT move, move_order FROM template_move WHERE template_id=?";
							  		$moves = $mysqli->execute_query($getMoves, [$game_template])->fetch_all(MYSQLI_ASSOC);
							  		foreach($moves as $move_key => $move) {
							  			if ($move['move'] != "") {
									  		echo $move['move_order']; print '. ';
									  		echo stripslashes($move['move']); print '<br />';
									  	}
							  		}
							  		print '<br /><strong>Levels</strong><br />';
							  		$getLevels = "SELECT level_id, level_name, level_order FROM template_level WHERE template_id=? AND level_name<>''";
									$levels = $mysqli->execute_query($getLevels, [$game_template])->fetch_all(MYSQLI_ASSOC);
									if (count($levels) > 0) {
										foreach($levels as $level_key => $level) {
								  			echo $level['level_order']; print '. '; 
								  			echo stripslashes($level['level_name']); print '<br />';
								  		}
								  	}
								}
								else {
									// Session info
									require('quipx/qxdb.php');
									$getSession = "SELECT subject, objectives, teamID, month, day, year, hour, minute, ampm, zone, duration_hours, duration_minutes FROM session WHERE sessionID=?";
									$session = $mysqli->execute_query($getSession, [$_POST['sessionID']])->fetch_assoc();
									print '<strong>'; echo stripslashes($session['subject']); print '</strong><br />';
									echo stripslashes($session['objectives']); print '<br /><br />';
									print 'm/d/y: '; echo $session['month']; print '/'; echo $session['day']; print '/'; echo $session['year']; print ' '; 
									echo $session['hour']; print ':'; echo $session['minute']; print ''; echo $session['ampm']; print ' '; echo $session['zone']; print ' (';
									echo $session['duration_hours']; print ':'; echo $session['duration_minutes']; print ')<br /><br />';
									// team
									require('accountsdb.php');
									$getTeamName = "SELECT teamName FROM ttteam WHERE teamID=?";
									$name = $mysqli->execute_query($getTeamName, [$session['teamID']])->fetch_assoc();
									print '<strong>Team</strong><br />'; echo stripslashes($name['teamName']); print '<br /><br />';
									// reflection
									print '<strong>Team reflection</strong><br />';
									require('quipx/qxdb.php');
									$getReflectItems = $mysqli->query("SELECT reflectItemID, reflectItem FROM reflect_item");
									while ($item_row = $getReflectItems->fetch_array()) {
										print '<div class="selectitemdiv">
											<div class="left">';
												echo stripslashes($item_row['reflectItem']);
												// average 
												$order = 0;
												$selectTotal = 0;
												$selectMean = 0;
												$getSelect = "SELECT reflectSelect FROM reflect_select WHERE sessionID=? AND reflectItemID=?";
												$selects = $mysqli->execute_query($getSelect, [$_POST['sessionID'], $item_row['reflectItemID']])->fetch_all(MYSQLI_ASSOC);
												$countselects = count($selects);
												foreach ($selects as $key => $select) {
													$selectTotal = $selectTotal + $select['reflectSelect'];
												}
												// mean calculations 
												$selectMean = round($selectTotal/$countselects);
												if ($selectMean >= $meanhigh) { 
													$meanhigh = $selectMean;
													$itemhigh = $item_row['reflectItemID'];
												}
												if ($selectMean <= $meanlow) {
													$meanlow = $selectMean;
													$itemlow = $item_row['reflectItemID'];
												}
											print '</div>
											<div class="right">';
												if ($selectMean > 0) print '<div class="selectitemlistcircle filled"></div>';
												else print '<div class="selectitemlistcircle"></div>';
												if ($selectMean > 1) print '<div class="selectitemlistcircle filled"></div>';
												else print '<div class="selectitemlistcircle"></div>';
												if ($selectMean > 2) print '<div class="selectitemlistcircle filled"></div>';
												else print '<div class="selectitemlistcircle"></div>';
												if ($selectMean > 3) print '<div class="selectitemlistcircle filled"></div>';
												else print '<div class="selectitemlistcircle"></div>';
												if ($selectMean > 4) print '<div class="selectitemlistcircle filled"></div>';
												else print '<div class="selectitemlistcircle"></div>';
											print '</div>
										</div>';
									}
									// discussion
									print '<br /><br /><strong>Discussion</strong><br />';
									require('quipx/qxdb.php');
									$getEntries = "SELECT sessionID, userID, entry FROM session_discuss WHERE sessionID=? ORDER BY discussID ASC";
									$entries = $mysqli->execute_query($getEntries, [$_POST['sessionID']])->fetch_all(MYSQLI_ASSOC);
									if (!empty($entries)) {
										print '<div style="height:300px; width:100%; border:none; overflow-y:auto">';
										foreach ($entries as $entry_key => $entry) {
											require('accountsdb.php');
											$getMem = "SELECT firstname, fontcolor FROM ttuser WHERE userID=?";
											$mem = $mysqli->execute_query($getMem, [$entry['userID']])->fetch_assoc();
											print '<span style="color:'.$mem['fontcolor'].'; -webkit-text-stroke-width: .25px; -webkit-text-stroke-color: #000000;">';
											echo $mem['firstname'];
											print "</span><br />";
											echo stripslashes($entry['entry']);
											print "<br /><br />";
										}
										print '</div>';
									}
								}
							print '</div>';
						}
					print '</div>
					';
				}
			?>
		</div>
	</body>
</html>
