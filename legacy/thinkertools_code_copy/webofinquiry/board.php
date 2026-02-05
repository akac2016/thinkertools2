<?php session_start();
	// user account db
	// require('../accountsdb.php');
	// woi db
	// require('woidb.php');
	// check session set 
	if (isset($_GET['game_id'])) $_SESSION['game_id'] = $_GET['game_id'];
	if (isset($_SESSION['game_id']) && isset($_SESSION['userID'])) $sessioncheck = 1;
	else $sessioncheck = 0;
	
	// set level_id if not in url, set session level_id
	if (!isset($_GET['level_id'])) $level_id = 0;
	else $_SESSION['level_id'] = $_GET['level_id'];
	
	// select update turn_id
	if ($_GET['action'] == "select") {
		require('woidb.php');
		$stmt = $mysqli->prepare("UPDATE game SET turn_id=? WHERE game_id=?");	
		$stmt->bind_param("ii", $_GET['turn_id'], $_SESSION['game_id']);
		$stmt->execute();
		$stmt->close();
	}
	
	// send message
	if ($_GET['action'] == "message") {
		// sender name
		require('../accountsdb.php');
		$getUserName = "SELECT firstname, lastname FROM ttuser WHERE userID =?";
		$userName = $mysqli->execute_query($getUserName, [$_SESSION['userID']])->fetch_assoc();
		$senderName = stripslashes($userName['firstname']) . " " . stripslashes($userName['lastname']);
		// get teamID
		require('woidb.php');
		$getTeam = "SELECT teamID FROM game WHERE game_id =?";
        $team = $mysqli->execute_query($getTeam, [$_SESSION['game_id']])->fetch_assoc();
        $teamID = $team['teamID'];
		// other message values
		$sentTime = date('Y-m-d H:i:s');
		$subject = "game comment";
		$recInd = 0;  
		$recOrg = 0; 
		$recAll = 0;
		$sessionID = 0;
		// send (insert) message
		require('../accountsdb.php');
		$stmt = $mysqli->prepare("INSERT INTO message (subject, message, sentTime, senderID, senderName, recInd, recTeam, recOrg, recAll, game_id, sessionID) VALUES (?,?,?,?,?,?,?,?,?,?,?)");
	  	$stmt->bind_param("sssisiiiiii", $subject, $_POST['message'], $sentTime, $_SESSION['userID'], $senderName, $recInd, $teamID, $recOrg, $recAll, $_SESSION['game_id'], $sessionID);
	  	$stmt->execute();
	  	$stmt->close();
	}
	// insert turn
	if ($_GET['action'] == 'insert') {
		if ($_SESSION['userID'] == $_SESSION['player']) {
			require "woidb.php";
			$user=$_SESSION['userID'];
	  		$game=$_SESSION['game_id'];
	  		$turn_tool=1; 
		  	$turn_move = $_POST['turn_move'];
		  	$turn_rule = $_POST['turn_rule'];
		  	$turn_level = $_GET['level_id'];
		  	$turnDateTime = date('Y-m-d H:i:s');
	  		$turn_text = $_POST['turn_text'];
			$stmt = $mysqli->prepare("INSERT INTO turn (game_id, user_id, turn_time, tool_id, move_id, rule_id, level_id) VALUES (?,?,?,?,?,?,?)");
	  		$stmt->bind_param("iisiiii", $game, $user, $turnDateTime, $turn_tool, $turn_move, $turn_rule, $turn_level);
	  		$stmt->execute();
	  		$stmt->close();
	  		sleep(1);
	  		// get turn_id and insert into turn_text
	  		$getTurnID = $mysqli->query("SELECT turn_id FROM turn WHERE user_id=".$user." AND turn_time='".$turnDateTime."'");
	  		if ($getTurnID->num_rows > 0) {
	  	  		while ($row = $getTurnID->fetch_array()) {
	  				$turn_id = $row['turn_id'];
	  			}
	  	  	}
	  	  	$stmt = $mysqli->prepare("INSERT INTO turn_text (turn_id, turn_text) VALUES (?,?)");
	  		$stmt->bind_param("is", $turn_id, $turn_text);
	  		$stmt->execute();
	  		$stmt->close();
	  		
	  		// increment turn - loop through team members to get the next turn
			$turn_id = $_SESSION['userID'];
			$getTeam = "SELECT teamID FROM game WHERE game_id=?";
			$team = $mysqli->execute_query($getTeam, [$_SESSION['game_id']])->fetch_assoc();
			$teamID = $team['teamID'];
			require('../accountsdb.php');
			$getTeamMem = "SELECT userID FROM ttteam_mem WHERE teamID=?";
			$teamMem = $mysqli->execute_query($getTeamMem, [$teamID])->fetch_all(MYSQLI_ASSOC);
			$teamMemCount = count($teamMem);
			$i = 1;
			foreach ($teamMem as $key => $teamMemID) {
				if ($teamMemID['userID'] == $turn_id) {
					if ($i < $teamMemCount) $nextTurnNum = $i + 1;
					else $nextTurnNum = 1;
				}
				$i = $i+1;
			}
			$i = 1;
			foreach ($teamMem as $key => $teamMemID) {
				if ($i == $nextTurnNum) {
					$nextTurnID = $teamMemID['userID'];
				}
				$i = $i+1;
			}	
			require('woidb.php');
			$stmt = $mysqli->prepare("UPDATE game SET turn_id=? WHERE game_id=?");	
			$stmt->bind_param("ii", $nextTurnID, $_SESSION['game_id']);
			$stmt->execute();
			$stmt->close();
			$turn_id = $nextTurnID;
			$_SESSION['player'] = $turn_id;
	  	}
	}
	// team check
	$teamcheck = 0;
	require('woidb.php');
	$getTeam = "SELECT teamID FROM game WHERE game_id=?";
	$team = $mysqli->execute_query($getTeam, [$_SESSION['game_id']])->fetch_assoc();
	require('../accountsdb.php');	
	$teamcheck = 0;
	$checkTeamMem = "SELECT teammemID FROM ttteam_mem WHERE teamID=? AND userID=?";
	$mem = $mysqli->execute_query($checkTeamMem, [$team['teamID'], $_SESSION['userID']])->fetch_assoc();
	if (!empty($mem)) {
		$teamcheck = 1;
		$teamID = $team['teamID'];
		// game info
		require "woidb.php";
		$getGame = "SELECT * FROM game WHERE game_id=?";
		$game = $mysqli->execute_query($getGame, [$_SESSION['game_id']])->fetch_assoc();
		$game_name = stripslashes($game['game_name']);	
		$game_description = stripslashes($game['game_description']);
		$game_template = $game['template_id'];
		$game_creator = $game['game_creator'];
		$game_public = $game['game_public'];
	}
?>
<!DOCTYPE html>
<html lang="en">
	<head>
		<meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
		<title>Web of Inquiry play</title>
		<link rel="stylesheet" href="../main.css" content="text/html; charset=utf-8"/>
		<link rel="stylesheet" href="woi.css" content="text/html; charset=utf-8"/>
		<!-- main head and dropdown menu -->
		<meta name="viewport" content="width=device-width, initial-scale=1">
		<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
		<link rel="stylesheet" href="../mainhead.css" content="text/html; charset=utf-8"/>
		<!-- html editor -->
		<script src="https://cdn.tiny.cloud/1/ymk7ajcxcxuz8awqpm6h3yfdljdjkv9aff60lqu0dvaxzuob/tinymce/6/tinymce.min.js" referrerpolicy="origin"></script>
		<script>
		    tinymce.init({
				selector: 'boardtext',
				relative_urls : false,
				remove_script_host : true,
				plugins: 'anchor autolink charmap codesample emoticons image link lists media searchreplace table visualblocks wordcount',
				toolbar: 'undo redo | blocks fontfamily fontsize | bold italic underline strikethrough | link image media table | align lineheight | numlist bullist indent outdent | emoticons charmap | removeformat',
			});
		</script>
	</head>
	<body>
		<div class="container">
			<?php
				require('mainhead.php');
			?>
			<div class="woilogodiv">
				<a href="home.php" class="woilogo">Web of Inquiry</a>
			</div>
			<div class="gamenavdiv">
				<div class="gamenavcirclediv">
					<div class="gamenavcircle current"></div>
					Play
				</div>
				<div class="gamenavcirclediv">
					<div class="gamenavcircle next"></div>
					Reflect
				</div>
				<?php 
					$loc = "'reflect.php'" ;
					print ' <button class="button150 finishmargin" onclick="window.location.href='.$loc.';">Finish play</button>';
				?>
			</div>
			<div class="column" style="width: 750px;">
				<div class="contentbox woiborder" style="margin-top: 12px; width: 620px;">
					<?php
						print '<strong>'; echo $game_name; print '</strong>';
					?>
				</div>
				<div style="width: 750px; display: inline-block;">
					<div class="contentbox woiborder" style="float: left; width: 620px;">
						<?php 
							if ($teamcheck == 1 && $sessioncheck == 1) {
								// play - level_id is set or 0 
								require('woidb.php');
								$turn_text = "";
								if (isset($_GET['level_id']) && $_GET['level_id'] > 0) {
									if ($_GET['level_id'] > 0) { 
										$getLevel = "SELECT level_name, level_object, level_order FROM template_level WHERE level_id=? AND level_name<>''";
										$level = $mysqli->execute_query($getLevel, [$_GET['level_id']])->fetch_assoc();
										print '<strong>Level '; echo $level['level_order']; print '</strong><br /> '; echo stripslashes($level['level_name']); 
										print '<br />';
										echo stripslashes($level['level_object']);
										print '<br />';
										print '<a href="board.php?action=turns&level_id='.$_GET['level_id'].'" class="textlink">Review turns taken in this level</a>';
										
										// show players with current turn, link to refresh
										print '<br /><br />';
										print '<div id="turn"></div>';
										print '<br />';
										print 'To display the updated game status or take your turn if the game board isn\'t visible, <a href="board.php?level_id='.$_SESSION['level_id'].'" class="textlink">refresh the page</a>.<br />';
										
										// show turns
										if ($_GET['action'] == "turns") {
											print '<br /><br />';
											require('woidb.php');
											$getTurns = "SELECT * FROM turn WHERE game_id=? and level_id=?";
											$turns = $mysqli->execute_query($getTurns, [$_SESSION['game_id'], $_GET['level_id']])->fetch_all(MYSQLI_ASSOC);
											foreach ($turns as $turn_key => $turn) {
												$turn_id = $turn['turn_id'];
									  			$turn_time = $turn['turn_time'];
									  			$move_id = $turn['move_id'];
									  			$rule_id = $turn['rule_id'];
									  			$tool_id = $turn['tool_id'];
									  			// get player username
									  			require('../accountsdb.php');
									  			$user_id = $turn['user_id'];
									  			print '<strong>Player:</strong> ';
									  			$getPlayer = "SELECT firstname FROM ttuser WHERE userID =?";
				        						$player = $mysqli->execute_query($getPlayer, [$user_id])->fetch_assoc();
									  			echo stripslashes($player['firstname']); print '<br />';
									  			// turn time
									  	  		print 'Turn time: '; echo $turn_time; print '<br />';
									  	  		require('woidb.php');
									  	  		// get move
									  	  		$getMove = "SELECT move FROM template_move WHERE move_id=?";
									  	  		$move = $mysqli->execute_query($getMove, [$move_id])->fetch_assoc();
									  	  		print 'Move: '; echo stripslashes($move['move']); print '<br />';
									  	  		// get rule
									  	  		if ($rule_id > 0) {
										  	  		$getRule = "SELECT rule FROM template_rule WHERE rule_id=?";
										  	  		$rule = $mysqli->execute_query($getRule, [$rule_id])->fetch_assoc();
									  	  			print 'Rule: '; echo stripslashes($rule['rule']); print '<br />';
									  	  		}
									  			// turn text
									  			$getTurnText = "SELECT turn_text FROM turn_text WHERE turn_id=?";
									  			$turnText = $mysqli->execute_query($getTurnText, [$turn_id])->fetch_assoc();
									  			echo stripslashes($turnText['turn_text']);
									  			print '=================<br /><br />';
											}
											print '<a href="board.php?level_id='.$_GET['level_id'].'" class="textlink">Close turns review</a>';
										}
										
										print '<br /><br />';
									}
									// current status (last entry)
									$getTurnTextID = $mysqli->query("SELECT turn_id FROM turn WHERE game_id=".$_SESSION['game_id']." ORDER BY turn_id DESC LIMIT 1");
							  		if ($getTurnTextID->num_rows > 0) {
							  	  		while ($text_row = $getTurnTextID->fetch_array()) {
							  				$turn_id = $text_row['turn_id'];
							  				$getTurnText = $mysqli->query("SELECT turn_text FROM turn_text WHERE turn_id='.$turn_id.'");
									  		if ($getTurnText->num_rows > 0) {
									  	  		while ($turntext_row = $getTurnText->fetch_array()) {
									  				$turn_text = $turntext_row['turn_text'];
									  				$turn_text = stripslashes($turn_text);
									  			}
									  		}
							  			}
							  		}
							  		// text editor
							  		if ($_SESSION['player'] == $_SESSION['userID']) {
								  		print '  
										  	<form action="board.php?action=insert&level_id='.$_GET["level_id"].'" method="post">';
										  	print '<boardtext id="turn_text" name="turn_text">'.$turn_text.'</boardtext>
										  	<br />
										  	<div class="fielddiv">
												<div class="fieldname">
													Move
												</div>
												<div class="fieldvalue">';
													print '<select name="turn_move" class="inputtext" style="height:36px; width:420px" required>';
													$getMoves = "SELECT * FROM template_move WHERE template_id=? AND move !=''";
											  		$moves = $mysqli->execute_query($getMoves, [$game_template])->fetch_all(MYSQLI_ASSOC);
											  		print '<option value="">select move (required)</option>';
											  		foreach($moves as $move_key => $move) {
												  		echo $move['move_order']; print '. ';
												  		$movetext = stripslashes($move['move']);
												  		print '<option value='.$move["move_id"].'>'.$movetext.'</option>';
												  		print '<br />';
											  		}
													print '</select>';
												print '</div>
											</div>
											<div class="fielddiv">
												<div class="fieldname">
													Rule
												</div>
												<div class="fieldvalue">';
													print '<select name="turn_rule" class="inputtext" style="height:36px; width:420px">';
													$getRules = "SELECT * FROM template_rule WHERE template_id=? AND rule !=''";
											  		$rules = $mysqli->execute_query($getRules, [$game_template])->fetch_all(MYSQLI_ASSOC);
											  		print '<option value="">select rule (optional)</option>';
											  		foreach($rules as $rule_key => $rule) {
												  		echo $rule['rule_order']; print '. ';
												  		$ruletext = stripslashes($rule['rule']);
												  		print '<option value='.$rule["rule_id"].'>'.$ruletext.'</option>';
												  		print '<br />';
											  		}
													print '</select>';
												print '</div>
											</div>
											<div class="fielddiv">
												<div class="fieldname">
												
												</div>
												<div class="fieldvalue">
													<input type="submit" name="submit" class="submitbutton" value="Submit" />
												</div>
											</div>
										  	</form>'
										;
									}
									else {
										// display current game status 
										echo stripslashes($turn_text);
									}
								}
								// plan
								else {
									// plan game descrip, team, template
									print '<div class="contentboxtitle">Game plan</div>';
									echo $game_description; 
									print '<br /><br />';
									require('../accountsdb.php');
									// team name
									$getTeamName = "SELECT teamName FROM ttteam WHERE teamID=?";
									$name = $mysqli->execute_query($getTeamName, [$teamID])->fetch_assoc();
									print '<strong>Team</strong><br />'; echo stripslashes($name['teamName']); print '<br />';
									// members
									$getMembers = "SELECT userID FROM ttteam_mem WHERE teamID=?";
									$mems = $mysqli->execute_query($getMembers, [$teamID])->fetch_all(MYSQLI_ASSOC);
									foreach ($mems as $memkey => $mem) {				
										$getUser = "SELECT firstname, lastname, fontcolor FROM ttuser WHERE userID=?";
										$user = $mysqli->execute_query($getUser, [$mem['userID']])->fetch_assoc();
										print '<span style="color: '.$user['fontcolor'].'; 
										-webkit-text-stroke-width: .25px; -webkit-text-stroke-color: #000000;">'; 
										echo $user['firstname']; print ' '; // $user['lastname'];
										print '</span> ';
									}
									print '<br /><br />';
									require('woidb.php');
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
							  		$getLevels = "SELECT level_id, level_name, level_object, level_order FROM template_level WHERE template_id=? AND level_name<>''";
									$levels = $mysqli->execute_query($getLevels, [$game_template])->fetch_all(MYSQLI_ASSOC);
									if (count($levels) > 0) {
										foreach($levels as $level_key => $level) {
								  			echo $level['level_order']; print '. ';
								  			print '<a href="board.php?level_id='.$level['level_id'].'" class="textlink">'; 
								  			echo stripslashes($level['level_name']); print '</a> (';
								  			echo stripslashes($level['level_object']); print ')<br />';
								  		}
								  	}
									else print '<a href="board.php?level_id=0" class="textlink">Play</a><br />';	
								}
							}
							else print 'You must be logged in and a member of the team to play this game.';
						?>
					</div>
					<div class="contentbox blank" style="float: right; width: 60px; text-align: center;">
						<?php 
							// tool icons removed
						?>
					</div>
				</div>
			</div>
			<!-- game map -->
			<div class="column" style="width: 300px; border: none; text-align: center; color: white;">
				<?php 
					require('woidb.php');
					$getLevels = "SELECT * FROM template_level WHERE template_id=? AND level_name <>''";
					$levels = $mysqli->execute_query($getLevels, [$game_template])->fetch_all(MYSQLI_ASSOC);
					if (!empty($levels)) {
						$level_count=count($levels);
						foreach($levels as $level_key => $level) {
							if ($level['level_order'] == 1) {
								$level1_id = $level['level_id'];
								$level1_name = stripslashes($level['level_name']);
							}
							if ($level['level_order'] == 2) {
								$level2_id = $level['level_id'];
								$level2_name = stripslashes($level['level_name']);
							}
							if ($level['level_order'] == 3) {
								$level3_id = $level['level_id'];
								$level3_name = stripslashes($level['level_name']);
							}
							if ($level['level_order'] == 4) {
								$level4_id = $level['level_id'];
								$level4_name = stripslashes($level['level_name']);
							}
							if ($level['level_order'] == 5) {
								$level5_id = $level['level_id'];
								$level5_name = stripslashes($level['level_name']);
							}
						}
					}
					else $level_count = 0; 
					
					if ($level_count == 0) {
						print '
						<div class="levelrow">';
							if (!isset($_GET['level_id'])) {
								print '<div class="levelcell level0bg"><img src="images/ellipse15.png" alt="pointer" width="36px" class="pointer" /><br /><a href="board.php" class="leveltext">Plan</a></div>';
							}
							else {
								print '<div class="levelcell level0bg"><br /><br /><a href="board.php" class="leveltext">Plan<a></div>';
							}
							if (isset($_GET['level_id'])) {
								print '<div class="levelcell level1bg"><img src="images/ellipse15.png" alt="pointer" width="36px" class="pointer" /><br /><a href="board.php?level_id=0" class="leveltext">Play</a></div>';
							}
							else {
								print '<div class="levelcell level1bg"><br /><br /><a href="board.php?level_id=0" class="leveltext">Play</a></div>';
							}
						print '</div>
						<div class="levelrow leveladjust">
							<div class="levelfinishblank"></div>
							<div class="levelfinish"><a href="reflect.php" class="leveltext">Finish</a></div>
						</div>
						';
					}
					
					if ($level_count == 1) {
						print '
						<div class="levelrow">';
							if (!isset($_GET['level_id']) || $_GET['level_id'] == 0) {
								print '<div class="levelcell level0bg"><img src="images/ellipse15.png" alt="pointer" width="36px" class="pointer" /><br /><a href="board.php" class="leveltext">Plan</a></div>';
							}
							else {
								print '<div class="levelcell level0bg"><br /><br /><a href="board.php" class="leveltext">Plan<a></div>';
							}
							if ($level1_id == $_GET['level_id']) {
								print '<div class="levelcell level1bg"><img src="images/ellipse15.png" alt="pointer" width="36px" class="pointer" /><br /><a href="board.php?level_id='.$level1_id.'" class="leveltext">1 '.$level1_name.'</a></div>';
							}
							else {
								print '<div class="levelcell level1bg"><br /><br /><a href="board.php?level_id='.$level1_id.'" class="leveltext">1 '.$level1_name.'</a></div>';
							}
						print '</div>
						<div class="levelrow leveladjust">
							<div class="levelfinishblank"></div>
							<div class="levelfinish"><a href="reflect.php" class="leveltext">Finish</a></div>
						</div>
						';
					}
					
					if ($level_count == 2) {
						print '
						<div class="levelrow">';
							if (!isset($_GET['level_id']) || $_GET['level_id'] == 0) {
								print '<div class="levelcell level0bg"><img src="images/ellipse15.png" alt="pointer" width="36px" class="pointer" /><br /><a href="board.php" class="leveltext">Plan</a></div>';
							}
							else {
								print '<div class="levelcell level0bg"><br /><br /><a href="board.php" class="leveltext">Plan<a></div>';
							}
							if ($level1_id == $_GET['level_id']) {
								print '<div class="levelcell level1bg"><img src="images/ellipse15.png" alt="pointer" width="36px" class="pointer" /><br /><a href="board.php?level_id='.$level1_id.'" class="leveltext">1 '.$level1_name.'</a></div>';
							}
							else {
								print '<div class="levelcell level1bg"><br /><br /><a href="board.php?level_id='.$level1_id.'" class="leveltext">1 '.$level1_name.'</a></div>';
							}
						print '</div>
						<div class="levelrow leveladjust">
							<div class="levelcellblank"></div>';
							if ($level2_id == $_GET['level_id']) {
								print '<div class="levelcell level2bg"><img src="images/ellipse15.png" alt="pointer" width="36px" class="pointer" /><br /><a href="board.php?level_id='.$level2_id.'" class="leveltext">2 '.$level2_name.'</a></div>';
							}
							else {
								print '<div class="levelcell level2bg"><br /><br /><a href="board.php?level_id='.$level2_id.'" class="leveltext">2 '.$level2_name.'</a></div>';
							}
						print '</div>
						<div class="levelrow leveladjust">
							<div class="levelfinishblank"></div>
							<div class="levelfinish"><a href="reflect.php" class="leveltext">Finish</a></div>
						</div>
						';
					}
					
					if ($level_count == 3) {
						print '
						<div class="levelrow">';
							if (!isset($_GET['level_id']) || $_GET['level_id'] == 0) {
								print '<div class="levelcell level0bg"><img src="images/ellipse15.png" alt="pointer" width="36px" class="pointer" /><br /><a href="board.php" class="leveltext">Plan</a></div>';
							}
							else {
								print '<div class="levelcell level0bg"><br /><br /><a href="board.php" class="leveltext">Plan<a></div>';
							}
							if ($level1_id == $_GET['level_id']) {
								print '<div class="levelcell level1bg"><img src="images/ellipse15.png" alt="pointer" width="36px" class="pointer" /><br /><a href="board.php?level_id='.$level1_id.'" class="leveltext">1 '.$level1_name.'</a></div>';
							}
							else {
								print '<div class="levelcell level1bg"><br /><br /><a href="board.php?level_id='.$level1_id.'" class="leveltext">1 '.$level1_name.'</a></div>';
							}
						print '</div>
						<div class="levelrow leveladjust">
							<div class="levelcellblank"></div>';
							if ($level2_id == $_GET['level_id']) {
								print '<div class="levelcell level2bg"><img src="images/ellipse15.png" alt="pointer" width="36px" class="pointer" /><br /><a href="board.php?level_id='.$level2_id.'" class="leveltext">2 '.$level2_name.'</a></div>';
							}
							else {
								print '<div class="levelcell level2bg"><br /><br /><a href="board.php?level_id='.$level2_id.'" class="leveltext">2 '.$level2_name.'</a></div>';
							}
						print '</div>
						<div style="width: 270x; height: 100px; margin-top:-3px; display: inline-block;">
							<div class="levelcellblank"></div>';
							if ($level3_id == $_GET['level_id']) {
								print '<div class="levelcell level3bg"><img src="images/ellipse15.png" alt="pointer" width="36px" class="pointer" /><br /><a href="board.php?level_id='.$level3_id.'" class="leveltext">3 '.$level3_name.'</a></div>';
							}
							else {
								print '<div class="levelcell level3bg"><br /><br /><a href="board.php?level_id='.$level3_id.'" class="leveltext">3 '.$level3_name.'</a></div>';
							}
						print '</div>
						<div class="levelrow leveladjust">
							<div class="levelfinishblank"></div>
							<div class="levelfinish"><a href="reflect.php" class="leveltext">Finish</a></div>
						</div>
						';
					}
					
					if ($level_count == 4) {
						print '
						<div class="levelrow">';
							if (!isset($_GET['level_id']) || $_GET['level_id'] == 0) {
								print '<div class="levelcell level0bg"><img src="images/ellipse15.png" alt="pointer" width="36px" class="pointer" /><br /><a href="board.php" class="leveltext">Plan</a></div>';
							}
							else {
								print '<div class="levelcell level0bg"><br /><br /><a href="board.php" class="leveltext">Plan<a></div>';
							}
							if ($level1_id == $_GET['level_id']) {
								print '<div class="levelcell level1bg"><img src="images/ellipse15.png" alt="pointer" width="36px" class="pointer" /><br /><a href="board.php?level_id='.$level1_id.'" class="leveltext">1 '.$level1_name.'</a></div>';
							}
							else {
								print '<div class="levelcell level1bg"><br /><br /><a href="board.php?level_id='.$level1_id.'" class="leveltext">1 '.$level1_name.'</a></div>';
							}
						print '</div>
						<div class="levelrow leveladjust">
							<div class="levelcellblank"></div>';
							if ($level2_id == $_GET['level_id']) {
								print '<div class="levelcell level2bg"><img src="images/ellipse15.png" alt="pointer" width="36px" class="pointer" /><br /><a href="board.php?level_id='.$level2_id.'" class="leveltext">2 '.$level2_name.'</a></div>';
							}
							else {
								print '<div class="levelcell level2bg"><br /><br /><a href="board.php?level_id='.$level2_id.'" class="leveltext">2 '.$level2_name.'</a></div>';
							}
						print '</div>
						<div class="levelrow leveladjust">';
							if ($level4_id == $_GET['level_id']) {
								print '<div class="levelcell level4bg"><img src="images/ellipse15.png" alt="pointer" width="36px" class="pointer" /><br /><a href="board.php?level_id='.$level4_id.'" class="leveltext">4 '.$level4_name.'</a></div>';
							}
							else {
								print '<div class="levelcell level4bg"><br /><br /><a href="board.php?level_id='.$level4_id.'" class="leveltext">4 '.$level4_name.'</a></div>';
							}
							if ($level3_id == $_GET['level_id']) {
								print '<div class="levelcell level3bg"><img src="images/ellipse15.png" alt="pointer" width="36px" class="pointer" /><br /><a href="board.php?level_id='.$level3_id.'" class="leveltext">3 '.$level3_name.'</a></div>';
							}
							else {
								print '<div class="levelcell level3bg"><br /><br /><a href="board.php?level_id='.$level3_id.'" class="leveltext">3 '.$level3_name.'</a></div>';
							}
						print '</div>
						<div class="levelrow leveladjust">
							<div class="levelfinish"><a href="reflect.php" class="leveltext">Finish</a></div>
							<div class="levelfinishblank"></div>
						</div>
						';
					}
					
					if ($level_count == 5) {
						print '
						<div class="levelrow">';
							if (!isset($_GET['level_id']) || $_GET['level_id'] == 0) {
								print '<div class="levelcell level0bg"><img src="images/ellipse15.png" alt="pointer" width="36px" class="pointer" /><br /><a href="board.php" class="leveltext">Plan</a></div>';
							}
							else {
								print '<div class="levelcell level0bg"><br /><br /><a href="board.php" class="leveltext">Plan<a></div>';
							}
							if ($level1_id == $_GET['level_id']) {
								print '<div class="levelcell level1bg"><img src="images/ellipse15.png" alt="pointer" width="36px" class="pointer" /><br /><a href="board.php?level_id='.$level1_id.'" class="leveltext">1 '.$level1_name.'</a></div>';
							}
							else {
								print '<div class="levelcell level1bg"><br /><br /><a href="board.php?level_id='.$level1_id.'" class="leveltext">1 '.$level1_name.'</a></div>';
							}
						print '</div>
						<div class="levelrow leveladjust">
							<div class="levelcellblank"></div>';
							if ($level2_id == $_GET['level_id']) {
								print '<div class="levelcell level2bg"><img src="images/ellipse15.png" alt="pointer" width="36px" class="pointer" /><br /><a href="board.php?level_id='.$level2_id.'" class="leveltext">2 '.$level2_name.'</a></div>';
							}
							else {
								print '<div class="levelcell level2bg"><br /><br /><a href="board.php?level_id='.$level2_id.'" class="leveltext">2 '.$level2_name.'</a></div>';
							}
						print '</div>
						<div class="levelrow leveladjust">';
							if ($level4_id == $_GET['level_id']) {
								print '<div class="levelcell level4bg"><img src="images/ellipse15.png" alt="pointer" width="36px" class="pointer" /><br /><a href="board.php?level_id='.$level4_id.'" class="leveltext">4 '.$level4_name.'</a></div>';
							}
							else {
								print '<div class="levelcell level4bg"><br /><br /><a href="board.php?level_id='.$level4_id.'" class="leveltext">4 '.$level4_name.'</a></div>';
							}
							if ($level3_id == $_GET['level_id']) {
								print '<div class="levelcell level3bg"><img src="images/ellipse15.png" alt="pointer" width="36px" class="pointer" /><br /><a href="board.php?level_id='.$level3_id.'" class="leveltext">3 '.$level3_name.'</a></div>';
							}
							else {
								print '<div class="levelcell level3bg"><br /><br /><a href="board.php?level_id='.$level3_id.'" class="leveltext">3 '.$level3_name.'</a></div>';
							}
						print '</div>
						<div class="levelrow leveladjust">';
							if ($level5_id == $_GET['level_id']) {
								print '<div class="levelcell level5bg"><img src="images/ellipse15.png" alt="pointer" width="36px" class="pointer" /><br /><a href="board.php?level_id='.$level5_id.'" class="leveltext">5 '.$level5_name.'</a></div>';
							}
							else {
								print '<div class="levelcell level5bg"><br /><br /><a href="board.php?level_id='.$level5_id.'" class="leveltext">5 '.$level5_name.'</a></div>';
							}
							print '<div class="levelcellblank"></div>';
						print '</div>
						<div class="levelrow leveladjust">
							<div class="levelfinish"><a href="reflect.php" class="leveltext">Finish</a></div>
							<div class="levelfinishblank"></div>
						</div>
						';
					}
				?>
				<div class="contentbox woiborder" style="margin-left: -96px; margin-top: -24px; width: 480px; height: 450px; overflow-y: auto; text-align: left;">
					<?php 
						if (isset($_GET['level_id'])) $level_id = $_GET['level_id'];
						else $level_id = 0;
						print '
						<div class="contentboxtitle">Comments <a href="board.php?level_id='.$level_id.'" class="textlink">refresh</a></div> 
						<form action="board.php?action=message&level_id='.$level_id.'" method="post" class="form" onsubmit="disableButton()" >
							<textarea name="message" class="textarea" placeholder="type comment" style="min-width: 450px;" required /></textarea>
							<input type="submit" name="submit" class="submitbutton" value="Enter" id="btn" />
						</form>';
					?>
					<br /><br />
					<?php
						require('../accountsdb.php');
						$getMessages = "SELECT * FROM message WHERE game_id=? ORDER BY messageID DESC";
						$messages = $mysqli->execute_query($getMessages, [$_SESSION['game_id']])->fetch_all(MYSQLI_ASSOC);
						if (!empty($messages)) {
							foreach($messages as $message) {
								echo stripslashes($message['senderName']); print ' ';
								echo $message['sentTime']; print ' ET<br />';
								echo stripslashes($message['message']); 
								print '<br /><br />';
							}
						}
					?>
				</div>
			</div>
		</div>
	</body>
</html>

<!-- turn, refresh every 1 sec -->
<script src="https://ajax.googleapis.com/ajax/libs/jquery/1.7.2/jquery.min.js"></script>
<script language="javascript" type="text/javascript">
	$(document).ready(function() {
		setInterval
		(function() {
			$('#turn').load('board-turn.php'); // turn is the div id
		}, 1000); // time to refresh the div in milliseconds
	});
</script>
<script>
    function disableButton() {
        var btn = document.getElementById('btn');
        btn.disabled = true;
        btn.innerText = 'Posting...'
    }
</script>