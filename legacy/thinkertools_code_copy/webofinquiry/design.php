<?php session_start();
	// user account db
	// require "../accountsdb.php";
	// woi db
	// require "woidb.php";
?>
<!DOCTYPE html>
<html>
	<head>
		<meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
		<title>Web of Inquiry design</title>
		<link rel="stylesheet" href="../main.css" content="text/html; charset=utf-8"/>
		<link rel="stylesheet" href="woi.css" content="text/html; charset=utf-8"/>
		<!-- main head and dropdown menu -->
		<meta name="viewport" content="width=device-width, initial-scale=1">
		<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
		<link rel="stylesheet" href="../mainhead.css" content="text/html; charset=utf-8"/>	
		<!-- css collapsible for select or new games -->
		<style>
			.collapsible {
			  background-color: white;
			  cursor: pointer;
			  padding: 18px;
			  width: 520px;
			  border: 1px solid black;
			  outline: none;
			  margin-bottom: 12px;
			  color: black;
			  text-align: left;
			  font-size: 16px;
			}
			.collapsible:after {
			  content: '\002B';
			  color: black;
			  font-weight: bold;
			  float: right;
			  margin-left: 5px;
			}
			.collapsible:hover {
			  background-color: #FCFDC2;
			  color: black;
			}
			.collapsible:hover::after {
			  background-color: #FCFDC2;
			  color: black;
			}
			.active {
			  background-color: #FCFDC2;
			  color: black;
			}
			.active:after {
			  content: "\2212";
			  color: black;
			}
			.content {
			  width: 495px;
			  padding: 0 18px;
			  margin-bottom: 12px;
			  max-height: 0;
			  overflow: hidden;
			  transition: max-height 0.2s ease-out;
			  color: black;
			  text-align: left;
			  font-size: 16px;
			}
		</style>
	</head>
	<body>
		<div class="container">
			<?php
				require('mainhead.php');
			?>
			<div class="woilogodiv">
				<a href="home.php" class="woilogo">Web of Inquiry</a>
			</div>
			<div class="column">
				<div class="contentbox blank">
					<?php 
					// not logged in
					if (!isset($_SESSION['userID'])) { 
						print ' ';
					}
					// new/modify buttons
					elseif (!isset($_GET['action'])) { 
						$loc1 = "'design.php?action=new'";
						$loc2 = "'design.php?action=edit'";
						print '
						<span class="columnheadtitle">Design or modify a game</span>
						<div class="buttondiv">
							<div class="left">
								<button type="button" class="button150" onclick="window.location.href='.$loc1.'">New</button>
							</div>
							<div class="left" style="margin-left:24px">
								<button type="button" class="button150" onclick="window.location.href='.$loc2.'">Modify</button>
							</div>
						</div>';
					}
					// insert new game
					elseif ($_GET['action'] == "insert") {
						print '<span class="columnheadtitle">Design a new game</span>';
						require('woidb.php');
						// new template 
						if ($_POST['template_id'] == 0) {
							// check for required fields
							if ($_POST['template_name'] == '' || $_POST['template_object'] == '' || $_POST['template_rule1'] == ''  || $_POST['template_rule2'] == ''  || $_POST['template_rule3'] == ''  || $_POST['template_move1'] == ''  || $_POST['template_move2'] == ''  || $_POST['template_move3'] == '') {
								print '<div class="contentbox woiborder">There was a problem with your game required fields, please go back to complete.<br /></div>';
							}
							else {
								// insert new template (note template_public = game_public)
								$modifiedDateTime = date('Y-m-d H:i:s');
						    	$stmt = $mysqli->prepare("INSERT INTO template (template_name, template_creator, template_modified, template_public, template_object) VALUES (?,?,?,?,?)");
								$stmt->bind_param("sisis", $_POST['template_name'], $_SESSION['userID'], $modifiedDateTime, $_POST['game_public'], $_POST['template_object']);
								$stmt->execute();
								$stmt->close();
								sleep(1);
								// get template_id
								$getTemplateID = "SELECT template_id FROM template WHERE template_modified=? AND template_creator=?";
								$template = $mysqli->execute_query($getTemplateID, [$modifiedDateTime, $_SESSION['userID']])->fetch_assoc();
								$template_id = $template['template_id'];
								// insert template rules
								$i=1;
								while ($i<8) {
						    	  	if ($i == 1) $rule=$_POST['template_rule1'];
						    	  	if ($i == 2) $rule=$_POST['template_rule2'];
						    	  	if ($i == 3) $rule=$_POST['template_rule3'];
						    	  	if ($i == 4) $rule=$_POST['template_rule4'];
						    	  	if ($i == 5) $rule=$_POST['template_rule5'];
						    	  	if ($i == 6) $rule=$_POST['template_rule6'];
						    	  	if ($i == 7) $rule=$_POST['template_rule7'];
						    	  	$stmt = $mysqli->prepare("INSERT INTO template_rule (template_id, rule, rule_order) VALUES (?,?,?)");
								  	$stmt->bind_param("isi", $template_id, $rule, $i);
								  	$stmt->execute();
								  	$stmt->close();
								  	$i=$i+1; 
								}
								// insert template moves 
								$i=1;
								while ($i<8) {
						    	  	if ($i == 1) $move=$_POST['template_move1'];
						    	  	if ($i == 2) $move=$_POST['template_move2'];
						    	  	if ($i == 3) $move=$_POST['template_move3'];
						    	  	if ($i == 4) $move=$_POST['template_move4'];
						    	  	if ($i == 5) $move=$_POST['template_move5'];
						    	  	if ($i == 6) $move=$_POST['template_move6'];
						    	  	if ($i == 7) $move=$_POST['template_move7'];
						    	  	$stmt = $mysqli->prepare("INSERT INTO template_move (template_id, move, move_order) VALUES (?,?,?)");
								  	$stmt->bind_param("isi", $template_id, $move, $i);
								  	$stmt->execute();
								  	$stmt->close();
								  	$i=$i+1; 
								}
								// insert levels 
								$i=1;
								while ($i<6) {
						    	  	$levelname = "";
						    	  	$levelobject = "";
						    	  	if ($i == 1) { $levelname = $_POST['level1_name']; $levelobject = $_POST['level1_object']; }
						    	  	if ($i == 2) { $levelname = $_POST['level2_name']; $levelobject = $_POST['level2_object']; }
						    	  	if ($i == 3) { $levelname = $_POST['level3_name']; $levelobject = $_POST['level3_object']; }
						    	  	if ($i == 4) { $levelname = $_POST['level4_name']; $levelobject = $_POST['level4_object']; }
						    	  	if ($i == 5) { $levelname = $_POST['level5_name']; $levelobject = $_POST['level5_object']; }
						    	  	$stmt = $mysqli->prepare("INSERT INTO template_level (template_id, level_name, level_object, level_order) VALUES (?,?,?,?)");
								  	$stmt->bind_param("issi", $template_id, $levelname, $levelobject, $i);
								  	$stmt->execute();
								  	$stmt->close();
								  	$i=$i+1; 
								}
								// insert template tool text only
								$tool_id = 1;
					    	  	$stmt = $mysqli->prepare("INSERT INTO template_tool (template_id, tool_id) VALUES (?,?)");
							  	$stmt->bind_param("ii", $template_id, $tool_id);
							  	$stmt->execute();
							  	$stmt->close(); 
							}
						}
						// insert game values with selected or new template_id
						if ($_POST['template_id'] > 0) $template_id = $_POST['template_id']; 
		    	  		// insert game 
		    	  		require('woidb.php');
		    	  		$startDateTime = date('Y-m-d H:i:s');
		    	  		$stmt = $mysqli->prepare("INSERT INTO game (template_id, game_creator, teamID, game_start, game_name, game_description, game_public, turn_id) VALUES (?,?,?,?,?,?,?,?)");
		    	  		$stmt->bind_param("iiisssii", $template_id, $_SESSION['userID'], $_POST['teamID'], $startDateTime, $_POST['game_name'], $_POST['game_description'], $_POST['game_public'], $_SESSION['userID']);
				  		$stmt->execute();
				  		$stmt->close();
				  		sleep(1);
				  		// get game_id 
				  		$getGameID = "SELECT game_id FROM game WHERE game_start=? AND game_creator=?";
				  		$gameID = $mysqli->execute_query($getGameID, [$startDateTime, $_SESSION['userID']])->fetch_assoc();
				  		$game_id = $gameID['game_id'];
				  		// play game link
				  		print '<div class="contentbox woiborder">';
				  		if (isset($game_id)) print 'Your game was successfully created. <a href="board.php?game_id='.$game_id.'" class="textlink">Play the game</a>';
				  		else print 'Check your <a href="play.php" class="textlink">games list</a> to play another game.';
				  		print '</div>';
					}
					// new game with template choice or create new
					elseif ($_GET['action'] == "new") {
						print '<span class="columnheadtitle">Design a new game</span>';
						// check if user is on a team
						require('../accountsdb.php');
						$getTeams = "SELECT teamID FROM ttteam_mem WHERE userID=?";
						$teams = $mysqli->execute_query($getTeams, [$_SESSION['userID']])->fetch_all(MYSQLI_ASSOC);
						// user not on a team
						if (count($teams) == 0) {
							print '<div class="contentbox woiborder">You must first <a href="../teams.php" class="textlink">set up a team</a> to create a game (even if you are the only person on the team). Click on the Teams click under your name.</div>';
						}
						// user is on a team
						else {
							print '<form action="design.php?action=insert" method="post" class="form" onsubmit="disableButton()"> 
							<div class="fielddiv">
								<div class="fieldname">
									Question
								</div>
								<div class="fieldvalue">
									<textarea name="game_name" class="textarea" placeholder="your brief inquiry question" required /></textarea>
								</div>
							</div>
							<div class="fielddiv">
								<div class="fieldname">
									Description
								</div>
								<div class="fieldvalue">
									<textarea name="game_description" class="textarea" placeholder="additional inquiry description" required /></textarea>
								</div>
							</div>
							<div class="fielddiv">
								<div class="fieldname">
									Team
								</div>
								<div class="fieldvalue fieldvaluebox">';
									// teams
									foreach($teams as $team_key => $team) {
										require('../accountsdb.php');
										$getTeam = "SELECT teamName FROM ttteam WHERE teamID =?";
										$teamName = $mysqli->execute_query($getTeam, [$team['teamID']])->fetch_assoc();
										print '<input name="teamID" type="radio" value="'.$team['teamID'].'" required>';
										echo stripslashes($teamName['teamName']);
										print '<br />';
									}
								print '</div>
							</div>
							<div class="fielddiv">
								<div class="fieldname">
									Private or public
								</div>
								<div class="fieldvalue">
									<input name="game_public" type="radio" value="0" checked /> private <input name="game_public" type="radio" value="1" /> public 
								</div>
							</div>
							<button type="button" class="collapsible">Select an existing game to play</button>
							<div class="content">';
								require('woidb.php');
								print '<select name="template_id" class="inputtext" style="min-height:40px; min-width:480px; border:none; outline:none">';
								print '<option value=0>see all games by category</option>';
								print '<option value=0>-----Structural-----</option>';
								$getTemplates = "SELECT template_id, template_name FROM template WHERE (template_public=1 OR template_creator=?) AND template_category='structural' ORDER BY template_name";
								$templates = $mysqli->execute_query($getTemplates, [$_SESSION['userID']])->fetch_all(MYSQLI_ASSOC);
								foreach ($templates as $template_key => $template) {
									print '<option value='.$template["template_id"].'>'.stripslashes($template["template_name"]).'</option>';
								}
								print '<option value=0>-----Functional-----</option>';
								$getTemplates = "SELECT template_id, template_name FROM template WHERE (template_public=1 OR template_creator=?) AND template_category='functional' ORDER BY template_name";
								$templates = $mysqli->execute_query($getTemplates, [$_SESSION['userID']])->fetch_all(MYSQLI_ASSOC);
								foreach ($templates as $template_key => $template) {
									print '<option value='.$template["template_id"].'>'.stripslashes($template["template_name"]).'</option>';
								}
								print '<option value=0>-----Process-----</option>';
								$getTemplates = "SELECT template_id, template_name FROM template WHERE (template_public=1 OR template_creator=?) AND template_category='process' ORDER BY template_name";
								$templates = $mysqli->execute_query($getTemplates, [$_SESSION['userID']])->fetch_all(MYSQLI_ASSOC);
								foreach ($templates as $template_key => $template) {
									print '<option value='.$template["template_id"].'>'.stripslashes($template["template_name"]).'</option>';
								}
								print '<option value=0>-----Uncategorized-----</option>';
								$getTemplates = "SELECT template_id, template_name FROM template WHERE (template_public=1 OR template_creator=?) AND template_category='' ORDER BY template_name";
								$templates = $mysqli->execute_query($getTemplates, [$_SESSION['userID']])->fetch_all(MYSQLI_ASSOC);
								foreach ($templates as $template_key => $template) {
									print '<option value='.$template["template_id"].'>'.stripslashes($template["template_name"]).'</option>';
								}
							  	print '</select>';
							print '</div>
							<button type="button" class="collapsible">Create a new game</button>
							<div class="content" style="width:524px; padding:0px">';
								print '<div class="fielddiv">
									<div class="fieldname">
										New game name
									</div>
									<div class="fieldvalue">
										<textarea name="template_name" class="textarea" style="min-height:36px; height:36px" placeholder="game name, must be unique, required" /></textarea>
									</div>
								</div>
								<div class="fielddiv">
									<div class="fieldname">
										Objective
									</div>
									<div class="fieldvalue">
										<textarea name="template_object" class="textarea" placeholder="game objective, required" /></textarea>
									</div>
								</div>
								<div class="fielddiv">
									<div class="fieldname">
										Rules<br />min 3 <br />max 7
									</div>
									<div class="fieldvalue">
										<textarea name="template_rule1" class="textarea" style="min-height:36px; height:36px" placeholder="game rule 1 required" /></textarea><br />
										<textarea name="template_rule2" class="textarea" style="min-height:36px; height:36px" placeholder="game rule 2 required" /></textarea><br />
										<textarea name="template_rule3" class="textarea" style="min-height:36px; height:36px" placeholder="game rule 3 required" /></textarea><br />
										<textarea name="template_rule4" class="textarea" style="min-height:36px; height:36px" placeholder="game rule 4" /></textarea><br />
										<textarea name="template_rule5" class="textarea" style="min-height:36px; height:36px" placeholder="game rule 5" /></textarea><br />
										<textarea name="template_rule6" class="textarea" style="min-height:36px; height:36px" placeholder="game rule 6" /></textarea><br />
										<textarea name="template_rule7" class="textarea" style="min-height:36px; height:36px" placeholder="game rule 7" /></textarea>
									</div>
								</div>
								<div class="fielddiv">
									<div class="fieldname">
										Moves<br />min 3 <br />max 7
									</div>
									<div class="fieldvalue">
										<textarea name="template_move1" class="textarea" style="min-height:36px; height:36px" placeholder="game move 1 required" /></textarea><br />
										<textarea name="template_move2" class="textarea" style="min-height:36px; height:36px" placeholder="game move 2 required" /></textarea><br />
										<textarea name="template_move3" class="textarea" style="min-height:36px; height:36px" placeholder="game move 3 required" /></textarea><br />
										<textarea name="template_move4" class="textarea" style="min-height:36px; height:36px" placeholder="game move 4" /></textarea><br />
										<textarea name="template_move5" class="textarea" style="min-height:36px; height:36px" placeholder="game move 5" /></textarea><br />
										<textarea name="template_move6" class="textarea" style="min-height:36px; height:36px" placeholder="game move 6" /></textarea><br />
										<textarea name="template_move7" class="textarea" style="min-height:36px; height:36px" placeholder="game move 7" /></textarea>
									</div>
								</div>
								<div class="fielddiv">
									<div class="fieldname">
										Level 1 optional
									</div>
									<div class="fieldvalue">
										<textarea name="level1_name" class="textarea" maxlength="30" style="min-height:36px; height:36px" placeholder="Level 1 name, max 30 chars" /></textarea><br />
										<textarea name="level1_object" class="textarea" style="min-height:36px; height:36px" placeholder="Level 1 objective" /></textarea><br />
									</div>
								</div>
								<div class="fielddiv">
									<div class="fieldname">
										Level 2 optional
									</div>
									<div class="fieldvalue">
										<textarea name="level2_name" class="textarea" maxlength="30" style="min-height:36px; height:36px" placeholder="Level 2 name, max 30 chars" /></textarea><br />
										<textarea name="level2_object" class="textarea" style="min-height:36px; height:36px" placeholder="Level 2 objective" /></textarea><br />
									</div>
								</div>
								<div class="fielddiv">
									<div class="fieldname">
										Level 3 optional
									</div>
									<div class="fieldvalue">
										<textarea name="level3_name" class="textarea" maxlength="30" style="min-height:36px; height:36px" placeholder="Level 3 name, max 30 chars" /></textarea><br />
										<textarea name="level3_object" class="textarea" style="min-height:36px; height:36px" placeholder="Level 3 objective" /></textarea><br />
									</div>
								</div>
								<div class="fielddiv">
									<div class="fieldname">
										Level 4 optional
									</div>
									<div class="fieldvalue">
										<textarea name="level4_name" class="textarea" maxlength="30" style="min-height:36px; height:36px" placeholder="Level 4 name, max 30 chars" /></textarea><br />
										<textarea name="level4_object" class="textarea" style="min-height:36px; height:36px" placeholder="Level 4 objective" /></textarea><br />
									</div>
								</div>
								<div class="fielddiv">
									<div class="fieldname">
										Level 5 optional
									</div>
									<div class="fieldvalue">
										<textarea name="level5_name" class="textarea" maxlength="30" style="min-height:36px; height:36px" placeholder="Level 5 name, max 30 chars" /></textarea><br />
										<textarea name="level5_object" class="textarea" style="min-height:36px; height:36px" placeholder="Level 5 objective" /></textarea><br />
									</div>
								</div>
							</div>
				      		<div class="fielddiv"">
								<div class="fieldname">
								
								</div>
								<div class="fieldvalue">
									<input type="submit" name="submit" class="submitbutton" value="Submit" id="btn" />
								</div>
							</div>
							</form>';
						}	
					}
					// update game and template
					elseif ($_GET['action'] == 'update') {
						print '<span class="columnheadtitle">Modify Game</span>';
						$game_id = $_GET['game_id'];
						require('woidb.php');
						// template (check if selected or edited)
						if (isset($_POST['template_name'])) {
							// get template_id
							$getTemplateID = "SELECT template_id FROM game WHERE game_id=?";
							$template = $mysqli->execute_query($getTemplateID, [$game_id])->fetch_assoc();
							$template_id = $template['template_id'];
							$modifiedDateTime = date('Y-m-d H:i:s');
							$stmt = $mysqli->prepare("UPDATE template SET template_name=?, template_object=?, template_public=?, template_modified=? WHERE template_id=?");
			    	  		$stmt->bind_param("ssisi", $_POST['template_name'], $_POST['template_object'], $_POST['game_public'], $modifiedDateTime, $template_id);
					  		$stmt->execute();
					  		$stmt->close();
					  		// update rules and moves
					  		$i=1;
							while ($i<8) {
					    	  	if ($i == 1) $rule=$_POST['template_rule1'];
					    	  	if ($i == 2) $rule=$_POST['template_rule2'];
					    	  	if ($i == 3) $rule=$_POST['template_rule3'];
					    	  	if ($i == 4) $rule=$_POST['template_rule4'];
					    	  	if ($i == 5) $rule=$_POST['template_rule5'];
					    	  	if ($i == 6) $rule=$_POST['template_rule6'];
					    	  	if ($i == 7) $rule=$_POST['template_rule7'];
					    	  	$stmt = $mysqli->prepare("UPDATE template_rule SET rule=? WHERE template_id=? AND rule_order=?");
							  	$stmt->bind_param("sii", $rule, $template_id, $i);
							  	$stmt->execute();
							  	$stmt->close();
							  	$i=$i+1; 
							}
							$i=1;
							while ($i<8) {
					    	  	if ($i == 1) $move=$_POST['template_move1'];
					    	  	if ($i == 2) $move=$_POST['template_move2'];
					    	  	if ($i == 3) $move=$_POST['template_move3'];
					    	  	if ($i == 4) $move=$_POST['template_move4'];
					    	  	if ($i == 5) $move=$_POST['template_move5'];
					    	  	if ($i == 6) $move=$_POST['template_move6'];
					    	  	if ($i == 7) $move=$_POST['template_move7'];
					    	  	$stmt = $mysqli->prepare("UPDATE template_move SET move=? WHERE template_id=? AND move_order=?");
							  	$stmt->bind_param("sii", $move, $template_id, $i);
							  	$stmt->execute();
							  	$stmt->close();
							  	$i=$i+1; 
							}
							$i=1;
							while ($i<6) {
					    	  	$levelname = "";
					    	  	$levelobject = "";
					    	  	if ($i == 1) { $levelname = $_POST['level1_name']; $levelobject = $_POST['level1_object']; }
					    	  	if ($i == 2) { $levelname = $_POST['level2_name']; $levelobject = $_POST['level2_object']; }
					    	  	if ($i == 3) { $levelname = $_POST['level3_name']; $levelobject = $_POST['level3_object']; }
					    	  	if ($i == 4) { $levelname = $_POST['level4_name']; $levelobject = $_POST['level4_object']; }
					    	  	if ($i == 5) { $levelname = $_POST['level5_name']; $levelobject = $_POST['level5_object']; }
					    	  	// check if level has been set up
					    	  	$getLevel = $mysqli->query("SELECT level_id FROM template_level WHERE template_id=".$template_id." AND level_order=".$i."");
								if ($getLevel->num_rows > 0) {
									$stmt = $mysqli->prepare("UPDATE template_level SET level_name=?, level_object=? WHERE   template_id=? AND level_order=?");
								  	$stmt->bind_param("ssii", $levelname, $levelobject, $template_id, $i);
								  	$stmt->execute();
								  	$stmt->close();
								}
								else {
									$stmt = $mysqli->prepare("INSERT INTO template_level (template_id, level_name, level_object, level_order) VALUES (?,?,?,?)");
								  	$stmt->bind_param("issi", $template_id, $levelname, $levelobject, $i);
								  	$stmt->execute();
								  	$stmt->close();
								}
							  	$i=$i+1; 
							}
					  	}
					  	// update game values, set selected template_id if no updated template
				  		if (!isset($_POST['template_name'])) {
				  			$template_id=$_POST['template_id'];
				  		}
				  		$stmt = $mysqli->prepare("UPDATE game SET template_id=?, teamID=?, game_name=?, game_description=?, game_public=? WHERE game_id=?");
		    	  		$stmt->bind_param("iissii", $template_id, $_POST['teamID'], $_POST['game_name'], $_POST['game_description'], $_POST['game_public'], $game_id);
				  		$stmt->execute();
				  		$stmt->close();
				  		// play game
				  		print '<div class="contentbox woiborder">Your game was successfully modified. <a href="board.php?game_id='.$game_id.'" class="textlink">Play the game</a></div>';
					}
					// edit game form
					elseif ($_GET['action'] == "edit" && isset($_GET['game_id'])) {
						print '<span class="columnheadtitle">Modify Game</span>';
						// check if user is game creator
						require('woidb.php');
						$game_id = $_GET['game_id'];
						$editGame = 1;
						$getGame = "SELECT * FROM game WHERE game_id=?";
						$game = $mysqli->execute_query($getGame, [$game_id])->fetch_assoc();
						if ($game['game_creator'] != $_SESSION['userID']) {
							$editGame = 0;
							print '<div class="contentbox woiborder">You must be the game designer to modify it.</div>';
						}
						// check if game in play
						else {
							$getTurn = "SELECT turn_id FROM turn WHERE game_id=?";
							$turn = $mysqli->execute_query($getTurn, [$_GET['game_id']])->fetch_assoc();
							if (!empty($turn)) {
								print '<div class="contentbox woiborder">This game is already in play. Modifying it may affect the results and turns taken. To change game from Private to Public, scroll down to that selection item, then scroll down to Submit the change.</div>';
							}
							$game_name = stripslashes($game['game_name']);  
				  		 	$game_description = stripslashes($game['game_description']);
				  		 	$game_public = $game['game_public'];
				  		 	$teamID = $game['teamID'];
				  		 	$template_id = $game['template_id'];
						}
						// game not in play
						if ($editGame == 1) {
							print '<form action="design.php?action=update&game_id='.$game_id.'" method="post" class="form"> 
							<div class="fielddiv"">
								<div class="fieldname">
									Question
								</div>
								<div class="fieldvalue">
									<textarea name="game_name" class="textarea" placeholder="your brief inquiry question" required />'.$game_name.'</textarea>
								</div>
							</div>
							<div class="fielddiv">
								<div class="fieldname">
									Description
								</div>
								<div class="fieldvalue">
									<textarea name="game_description" class="textarea" placeholder="additional inquiry question description" required />'.$game_description.'</textarea>
								</div>
							</div>
							<div class="fielddiv">
								<div class="fieldname">
									Team
								</div>
								<div class="fieldvalue fieldvaluebox">';
									// teams
									require('../accountsdb.php');
									$getTeams = "SELECT teamID FROM ttteam_mem WHERE userID=?";
									$teams = $mysqli->execute_query($getTeams, [$_SESSION['userID']])->fetch_all(MYSQLI_ASSOC);
									foreach($teams as $team_key => $team) {
										if ($teamID == $team['teamID']) $checked = "checked";
										else $checked = "";
										$getTeam = "SELECT teamName FROM ttteam WHERE teamID =?";
										$teamName = $mysqli->execute_query($getTeam, [$team['teamID']])->fetch_assoc();
										print '<input name="teamID" type="radio" value="'.$team['teamID'].'" '.$checked.' required>';
										echo stripslashes($teamName['teamName']);
										print '<br />';
									}
								print '</div>
							</div>
							<div class="fielddiv">
								<div class="fieldname">
									Private or public
								</div>
								<div class="fieldvalue">';
									if ($game_public == 0) print '<input name="game_public" type="radio" value="0" checked /> private <input name="game_public" type="radio" value="1" /> public';
						      		else print '<input name="game_public" type="radio" value="0" /> private <input name="game_public" type="radio" value="1" checked /> public';
								print '</div>
							</div>';
							// template selected or editable
							require('woidb.php'); 
							$getTemplate = "SELECT * FROM template WHERE template_id=? AND template_creator=?";
							$template = $mysqli->execute_query($getTemplate, [$template_id, $_SESSION['userID']])->fetch_assoc();
							// selected
							if (empty($template)) {
								$getTemplateSelect = "SELECT template_name FROM template WHERE template_id=?";
								$templateSelect = $mysqli->execute_query($getTemplateSelect, [$template_id])->fetch_assoc();
								$selectName = stripslashes($templateSelect['template_name']);
								print '<div class="fielddiv">
									<div class="fieldname">
										Game
									</div>
									<div class="fieldvalue">';
										print '<select name="template_id" class="inputtext" style="min-height:40px; min-width:420px">';
										print '<option value='.$template_id.'>'.$selectName.'</option>';
										print '<option value=0>-----Structural-----</option>';
										$getTemplates = "SELECT template_id, template_name FROM template WHERE (template_public=1 OR template_creator=?) AND template_category='structural' ORDER BY template_name";
										$templates = $mysqli->execute_query($getTemplates, [$_SESSION['userID']])->fetch_all(MYSQLI_ASSOC);
										foreach ($templates as $template_key => $template) {
											print '<option value='.$template["template_id"].'>'.stripslashes($template["template_name"]).'</option>';
										}
										print '<option value=0>-----Functional-----</option>';
										$getTemplates = "SELECT template_id, template_name FROM template WHERE (template_public=1 OR template_creator=?) AND template_category='functional' ORDER BY template_name";
										$templates = $mysqli->execute_query($getTemplates, [$_SESSION['userID']])->fetch_all(MYSQLI_ASSOC);
										foreach ($templates as $template_key => $template) {
											print '<option value='.$template["template_id"].'>'.stripslashes($template["template_name"]).'</option>';
										}
										print '<option value=0>-----Process-----</option>';
										$getTemplates = "SELECT template_id, template_name FROM template WHERE (template_public=1 OR template_creator=?) AND template_category='process' ORDER BY template_name";
										$templates = $mysqli->execute_query($getTemplates, [$_SESSION['userID']])->fetch_all(MYSQLI_ASSOC);
										foreach ($templates as $template_key => $template) {
											print '<option value='.$template["template_id"].'>'.stripslashes($template["template_name"]).'</option>';
										}
										print '<option value=0>-----Uncategorized-----</option>';
										$getTemplates = "SELECT template_id, template_name FROM template WHERE (template_public=1 OR template_creator=?) AND template_category='' ORDER BY template_name";
										$templates = $mysqli->execute_query($getTemplates, [$_SESSION['userID']])->fetch_all(MYSQLI_ASSOC);
										foreach ($templates as $template_key => $template) {
											print '<option value='.$template["template_id"].'>'.stripslashes($template["template_name"]).'</option>';
										}
									  	print '</select>';
									print '</div>
								</div>';
							}
							// editable
							else {
								$template_id = $template['template_id'];
					  		 	$template_name = stripslashes($template['template_name']);  
					  		 	$template_object = stripslashes($template['template_object']);
					  		 	$template_public = $template['template_public'];
								print '
								<div class="fielddiv">
									<div class="fieldname">
										Game name
									</div>
									<div class="fieldvalue">
										<textarea name="template_name" class="textarea" style="min-height:36px; height:36px" placeholder="game template name" required />'.$template_name.'</textarea>
									</div>
								</div>
								<div class="fielddiv">
									<div class="fieldname">
										Objective
									</div>
									<div class="fieldvalue">
										<textarea name="template_object" class="textarea" placeholder="game objective" required />'.$template_object.'</textarea>
									</div>
								</div>
								<div class="fielddiv">
									<div class="fieldname">
										Rules<br />min 3 <br />max 7
									</div>
									<div class="fieldvalue">';
										$i=1;
							        	while ($i < 8) {
							        		$getRule = "SELECT * FROM template_rule WHERE template_id=? AND rule_order=?";
							        		$rule = $mysqli->execute_query($getRule, [$template_id, $i])->fetch_assoc();
											if ($i==1) print '<textarea name="template_rule1" class="textarea" style="min-height:36px; height:36px" placeholder="game rule 1" required />'.stripslashes($rule['rule']).'</textarea>';
											if ($i==2) print '<textarea name="template_rule2" class="textarea" style="min-height:36px; height:36px" placeholder="game rule 2" required />'.stripslashes($rule['rule']).'</textarea>';
											if ($i==3) print '<textarea name="template_rule3" class="textarea" style="min-height:36px; height:36px" placeholder="game rule 3" required />'.stripslashes($rule['rule']).'</textarea>';
											if ($i==4) print '<textarea name="template_rule4" class="textarea" style="min-height:36px; height:36px" placeholder="game rule 4" />'.stripslashes($rule['rule']).'</textarea>';
											if ($i==5) print '<textarea name="template_rule5" class="textarea" style="min-height:36px; height:36px" placeholder="game rule 5" />'.stripslashes($rule['rule']).'</textarea>';
											if ($i==6) print '<textarea name="template_rule6" class="textarea" style="min-height:36px; height:36px" placeholder="game rule 6" />'.stripslashes($rule['rule']).'</textarea>';
											if ($i==7) print '<textarea name="template_rule7" class="textarea" style="min-height:36px; height:36px" placeholder="game rule 7" />'.stripslashes($rule['rule']).'</textarea>';
	
											print '<br />';
							        		$i=$i+1;
							        	}
									print '</div>
								</div>
								<div class="fielddiv">
									<div class="fieldname">
										Moves<br />min 3 <br />max 7
									</div>
									<div class="fieldvalue">';
										$i=1;
							        	while ($i < 8) {
							        		$getMove = "SELECT * FROM template_move WHERE template_id=? AND move_order=?";
							        		$move = $mysqli->execute_query($getMove, [$template_id, $i])->fetch_assoc();
											if ($i==1) print '<textarea name="template_move1" class="textarea" style="min-height:36px; height:36px" placeholder="game move 1" required />'.stripslashes($move['move']).'</textarea>';
											if ($i==2) print '<textarea name="template_move2" class="textarea" style="min-height:36px; height:36px" placeholder="game move 2" required />'.stripslashes($move['move']).'</textarea>';
											if ($i==3) print '<textarea name="template_move3" class="textarea" style="min-height:36px; height:36px" placeholder="game move 3" required />'.stripslashes($move['move']).'</textarea>';
											if ($i==4) print '<textarea name="template_move4" class="textarea" style="min-height:36px; height:36px" placeholder="game move 4" />'.stripslashes($move['move']).'</textarea>';
											if ($i==5) print '<textarea name="template_move5" class="textarea" style="min-height:36px; height:36px" placeholder="game move 5" />'.stripslashes($move['move']).'</textarea>';
											if ($i==6) print '<textarea name="template_move6" class="textarea" style="min-height:36px; height:36px" placeholder="game move 6" />'.stripslashes($move['move']).'</textarea>';
											if ($i==7) print '<textarea name="template_move7" class="textarea" style="min-height:36px; height:36px" placeholder="game move 7" />'.stripslashes($move['move']).'</textarea>';
											print '<br />';
							        		$i=$i+1;
							        	}
									print '</div>
								</div>
								<div class="fielddiv">
									<div class="fieldname">
										Level 1 optional
									</div>
									<div class="fieldvalue">';
										$level_name = "";
										$level_object = "";
										$getLevel = "SELECT * FROM template_level WHERE template_id=? AND level_order=1";
										$level = $mysqli->execute_query($getLevel, [$template_id])->fetch_assoc();
										$level_name = stripslashes($level['level_name']);
										$level_object = stripslashes($level['level_object']);
										print '<textarea name="level1_name" class="textarea" maxlength="30" style="min-height:36px; height:36px" placeholder="Level 1 name, max 30 chars" />'.$level_name.'</textarea><br />
										<textarea name="level1_object" class="textarea" style="min-height:36px; height:36px" placeholder="Level 1 objective" />'.$level_object.'</textarea><br />
									</div>
								</div>
								<div class="fielddiv">
									<div class="fieldname">
										Level 2 optional
									</div>
									<div class="fieldvalue">';
										$level_name = "";
										$level_object = "";
										$getLevel = "SELECT * FROM template_level WHERE template_id=? AND level_order=2";
										$level = $mysqli->execute_query($getLevel, [$template_id])->fetch_assoc();
										$level_name = stripslashes($level['level_name']);
										$level_object = stripslashes($level['level_object']);
										print '<textarea name="level2_name" class="textarea" maxlength="30" style="min-height:36px; height:36px" placeholder="Level 2 name, max 30 chars" />'.$level_name.'</textarea><br />
										<textarea name="level2_object" class="textarea" style="min-height:36px; height:36px" placeholder="Level 2 objective" />'.$level_object.'</textarea><br />
									</div>
								</div>
								<div class="fielddiv">
									<div class="fieldname">
										Level 3 optional
									</div>
									<div class="fieldvalue">';
										$level_name = "";
										$level_object = "";
										$getLevel = "SELECT * FROM template_level WHERE template_id=? AND level_order=3";
										$level = $mysqli->execute_query($getLevel, [$template_id])->fetch_assoc();
										$level_name = stripslashes($level['level_name']);
										$level_object = stripslashes($level['level_object']);
										print '<textarea name="level3_name" class="textarea" maxlength="30" style="min-height:36px; height:36px" placeholder="Level 3 name, max 30 chars" />'.$level_name.'</textarea><br />
										<textarea name="level3_object" class="textarea" style="min-height:36px; height:36px" placeholder="Level 3 objective" />'.$level_object.'</textarea><br />
									</div>
								</div>
								<div class="fielddiv">
									<div class="fieldname">
										Level 4 optional
									</div>
									<div class="fieldvalue">';
										$level_name = "";
										$level_object = "";
										$getLevel = "SELECT * FROM template_level WHERE template_id=? AND level_order=4";
										$level = $mysqli->execute_query($getLevel, [$template_id])->fetch_assoc();
										$level_name = stripslashes($level['level_name']);
										$level_object = stripslashes($level['level_object']);
										print '<textarea name="level4_name" class="textarea" maxlength="30" style="min-height:36px; height:36px" placeholder="Level 4 name, max 30 chars" />'.$level_name.'</textarea><br />
										<textarea name="level4_object" class="textarea" style="min-height:36px; height:36px" placeholder="Level 4 objective" />'.$level_object.'</textarea><br />
									</div>
								</div>
								<div class="fielddiv">
									<div class="fieldname">
										Level 5 optional
									</div>
									<div class="fieldvalue">';
										$level_name = "";
										$level_object = "";
										$getLevel = "SELECT * FROM template_level WHERE template_id=? AND level_order=5";
										$level = $mysqli->execute_query($getLevel, [$template_id])->fetch_assoc();
										$level_name = stripslashes($level['level_name']);
										$level_object = stripslashes($level['level_object']);
										print '<textarea name="level5_name" class="textarea" maxlength="30" style="min-height:36px; height:36px" placeholder="Level 5 name, max 30 chars" />'.$level_name.'</textarea><br />
										<textarea name="level5_object" class="textarea" style="min-height:36px; height:36px" placeholder="Level 5 objective" />'.$level_object.'</textarea><br />
									</div>
								</div>';
							}
				      		print '
				      		<div class="fielddiv"">
								<div class="fieldname">
								
								</div>
								<div class="fieldvalue">
									<input type="submit" name="submit" class="submitbutton" value="Submit" />
								</div>
							</div>
							</form>';
						}
					}
					?>
				</div>
			</div>
			<div class="column">
				<div class="contentbox blank">
				<?php
					if (!isset($_SESSION['userID'])) {
						print '<div class="toolbox login">
						<a href="../login.php" class="toollink">Login to get started </a>
						</div>';
					}
					else {
						if ($_GET['action'] == "edit" || $_GET['action'] == "update") {
							// games to modify
							print '<span class="columnheadtitle">Your Games</span><br />
							Click a game to modify
							<div class="contentbox woiborder">';
								require('woidb.php');
								$getGames = "SELECT game_id, game_name FROM game WHERE game_creator=?";
								$games = $mysqli->execute_query($getGames, [$_SESSION['userID']])->fetch_all(MYSQLI_ASSOC);
								if (!empty($games)) {
									foreach($games as $game_key => $game) {
										$game_id = $game['game_id'];
								  		$game_name = stripslashes($game['game_name']);
								  		print '<a href="design.php?action=edit&game_id='.$game_id.'" class="textlink">'.$game_name.'</a><br />';
									}
								}
							print '</div><br />';
						}
						// instructions
						print '
						<span class="columnheadtitle">Instructions</span> <br />';
						if (isset($_GET['action'])) print '<a href="design.php?action=new" class="textlink">new game</a> | <a href="design.php?action=edit" class="textlink">modify game</a>';
						print '<div class="contentbox woiborder"> 
						Designing a Web of Inquiry game begins with a question. The game helps you and your team answer the question. Each game consists of a set of rules and moves that answers specific kinds of inquiry questions.<br /><br />
						<strong>Step 1.</strong> Come up with your concise inquiry question.<br /><br />
						<strong>Step 2.</strong> Further explain your inquiry for your team members or others when you make your game public.<br /><br />
						<strong>Step 3.</strong> Select your team and chose if your game is private or public. You can change your game\'s status at any time. Note that your game question is always viewable by anyone, but your game results are only viewable if public.<br /><br />
						<strong>Step 4.</strong> Examine where your question falls in three general inquiry categories: Structural, Functional, Process. This will help you determine which game to play or create. View a <a href="library.php?select=3" target="_blank" class="textlink">chart explaining these categories with examples</a>.<br /><br />
						<strong>Step 5.</strong> Select an existing game or create a new inquiry game. <br />View the library of public games and their descriptions by <a href="library.php?select=1" target="_blank" class="textlink">subject</a> or by <a href="library.php?select=2" target="_blank" class="textlink">category</a>. View the <a href="library.php?select=4" target="_blank" class="textlink">elements of a game</a> to help create yours.
						</div>';
					}	
				?>
				</div>
			</div>
		</div>
	</body>
</html>
<!-- css collapsible for select or new games -->
<script>
	var coll = document.getElementsByClassName("collapsible");
	var i;
	
	for (i = 0; i < coll.length; i++) {
	  coll[i].addEventListener("click", function() {
	    this.classList.toggle("active");
	    var content = this.nextElementSibling;
	    if (content.style.maxHeight){
	      content.style.maxHeight = null;
	    } else {
	      content.style.maxHeight = content.scrollHeight + "px";
	    } 
	  });
	}
</script>
<script>
    function disableButton() {
        var btn = document.getElementById('btn');
        btn.disabled = true;
        btn.innerText = 'Posting...'
    }
</script>