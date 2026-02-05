<?php session_start(); 
	// db access
	// require('accountsdb.php');
	// require('webofinquiry/woidb.php');
	// require('quipx/qxdb.php');
	// set admin access
	if ($_GET['action'] == "check") {
		$_SESSION['access'] = 0;
		if ($_SESSION['userID'] == 5) {
			if ($_POST['access'] == "#cae435") {
				$_SESSION['access'] = 1;
			}
		}
		if ($_SESSION['userID'] == 108) {
			if ($_POST['access'] == "#31fc4a") {
				$_SESSION['access'] = 1;
			}
		}
	}
?>
<!DOCTYPE html>
<html lang="en">
	<head>
		<meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
		<title>Thinkertools control</title>
		<link rel="stylesheet" href="main.css" content="text/html; charset=utf-8"/>
		<!-- main head and dropdown menu -->
		<meta name="viewport" content="width=device-width, initial-scale=1">
		<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
		<link rel="stylesheet" href="mainhead.css" content="text/html; charset=utf-8"/>
	</head>
	<body>
		<div class="container">
			<?php
				require('mainhead.php');
				if (!isset($_SESSION['userID'])) {
					print '
					<div class="column">
						<div class="toolbox login">
							<a href="login.php" class="toollink">Login</a>
						</div>
					</div>';
				}
				elseif ($_SESSION['userID'] == 5 || $_SESSION['userID'] == 108) {
					// access code check
					if ($_SESSION['access'] == 0) {
						print '<form action="control.php?action=check" method="post" class="form">
						<input name="access" type="text" class="inputtext" placeholder="access code" required />
						<input type="submit" name="submit" class="submitbutton" value="submit" />
						';
					} 
					else {
						// left column navigation
						print '
						<div class="column">
							<div class="contentbox">
								<a href="control.php?action=reports" class="textlink">Reports</a> 
								daily, monthly, yearly
							</div>
							<div class="contentbox">
								<a href="control.php?action=userform" class="textlink">User Accounts</a> 
								profile and admin
							</div>
							<div class="contentbox">
								<a href="control.php?action=orgs" class="textlink">Organizations</a> 
								select from all orgs
							</div>
							<div class="contentbox">
								<a href="control.php?action=teams" class="textlink">Teams</a>
								select from all teams
							</div>
							<div class="contentbox">
								<a href="control.php?action=messages" class="textlink">Messages</a> select from all messages
							</div>
							<div class="contentbox">
								<a href="control.php?action=woi" class="textlink">Web of Inquiry</a> select from templates, games, content
							</div>
							<div class="contentbox">
								<a href="control.php?action=quipx" class="textlink">Quipx</a> select from sessions, content
							</div>
							<div class="contentbox">
								Teacher
							</div>
						</div>';
						
						// right column action form
						print '<div class="column">
							<div class="contentbox">';
								// ================================= no action =======================================================
								if (!isset($_GET['action']) || $_GET['action'] == "check") {
									print 'Information Results<br />';
								}
								// ================ reports  =================
								if ($_GET['action'] == "reports" && !isset($_GET['userID'])) {
									print 'Reports<br /><br />';
									// set date
									$dateString = date('Y-m-d'); echo $dateString; print ' day/month/year/total<br />';
									// users, orgs, teams
									require('accountsdb.php');
									$getUsers = "SELECT startdate FROM ttuser";
									$users = $mysqli->execute_query($getUsers)->fetch_all(MYSQLI_ASSOC);
									$totalUsers = count($users);
									$dayUsers = 0;
									$monthUsers = 0;
									$yearUsers = 0;
									foreach ($users as $users => $user) {
										if (substr($user['startdate'], 0, 10) == $dateString) {
											$dayUsers = $dayUsers + 1;
										}
										if (substr($user['startdate'], 0, 7) == substr($dateString, 0, 7)) {
											$monthUsers = $monthUsers + 1;
										}
										if (substr($user['startdate'], 0, 4) == substr($dateString, 0, 4)) {
											$yearUsers = $yearUsers + 1;
										}
									}
									print 'Users '; echo $dayUsers; print '/';  echo $monthUsers; print '/'; echo $yearUsers; print '/'; echo $totalUsers; print '<br />';
									$getOrgs = "SELECT orgCreated FROM ttorg";
									$orgs = $mysqli->execute_query($getOrgs)->fetch_all(MYSQLI_ASSOC);
									$totalOrgs = count($orgs);
									$dayOrgs = 0;
									$monthOrgs = 0;
									$yearOrgs = 0;
									foreach ($orgs as $orgs_key => $org) {
										if (substr($org['orgCreated'], 0, 10) == $dateString) {
											$dayOrgs = $dayOrgs + 1;
										}
										if (substr($org['orgCreated'], 0, 7) == substr($dateString, 0, 7)) {
											$monthOrgs = $monthOrgs + 1;
										}
										if (substr($org['orgCreated'], 0, 4) == substr($dateString, 0, 4)) {
											$yearOrgs = $yearOrgs + 1;
										}
									}
									print 'Orgs '; echo $dayOrgs; print '/'; echo $monthOrgs; print '/'; echo $yearOrgs; print '/'; echo $totalOrgs; print '<br />';
									$getTeams = "SELECT teamCreated FROM ttteam";
									$teams = $mysqli->execute_query($getTeams)->fetch_all(MYSQLI_ASSOC);
									$totalTeams = count($teams);
									$dayTeams = 0;
									$monthTeams = 0;
									$yearTeams = 0;
									foreach ($teams as $teams_key => $team) {
										if (substr($team['teamCreated'], 0, 10) == $dateString) {
											$dayTeams = $dayTeams + 1;
										}
										if (substr($team['teamCreated'], 0, 7) == substr($dateString, 0, 7)) {
											$monthTeams = $monthTeams + 1;
										}
										if (substr($team['teamCreated'], 0, 4) == substr($dateString, 0, 4)) {
											$yearTeams = $yearTeams + 1;
										}
									}
									print 'Teams '; echo $dayTeams; print '/'; echo $monthTeams; print '/'; echo $yearTeams; print '/'; echo $totalTeams; print '<br />';
									require('webofinquiry/woidb.php');
									$getGames = "SELECT game_start FROM game";
									$games = $mysqli->execute_query($getGames)->fetch_all(MYSQLI_ASSOC);
									$totalGames = count($games);
									$dayGames = 0;
									$monthGames = 0;
									$yearGames = 0;
									foreach ($games as $games_key => $game) {
										if (substr($game['game_start'], 0, 10) == $dateString) {
											$dayGames = $dayGames + 1;
										}
										if (substr($game['game_start'], 0, 7) == substr($dateString, 0, 7)) {
											$monthGames = $monthGames + 1;
										}
										if (substr($game['game_start'], 0, 4) == substr($dateString, 0, 4)) {
											$yearGames = $yearGames + 1;
										}
									}
									print 'Games '; echo $dayGames; print '/'; echo $monthGames; print '/'; echo $yearGames; print '/'; echo $totalGames; print '<br />';
									require('quipx/qxdb.php');
									$getSessions = "SELECT created FROM session";
									$sessions = $mysqli->execute_query($getSessions)->fetch_all(MYSQLI_ASSOC);
									$totalSessions = count($sessions);
									$daySessions = 0;
									$monthSessions = 0;
									$yearSessions = 0;
									foreach ($sessions as $sessions_key => $session) {
										if (substr($session['created'], 0, 10) == $dateString) {
											$daySessions = $daySessions + 1;
										}
										if (substr($session['created'], 0, 7) == substr($dateString, 0, 7)) {
											$monthSessions = $monthSessions + 1;
										}
										if (substr($session['created'], 0, 4) == substr($dateString, 0, 4)) {
											$yearSessions = $yearSessions + 1;
										}
									}
									print 'Sessions '; echo $daySessions; print '/'; echo $monthSessions; print '/'; echo $yearSessions; print '/'; echo $totalSessions; print '<br />';
								}
								// ================ quipx sessions  =================
								if ($_GET['action'] == "quipx" && !isset($_GET['userID'])) {
									print 'Quipx Information<br /><br />';
									require "quipx/qxdb.php";
									if (isset($_GET['sessionID']) || isset($_POST['sessionID'])) {
								  		if (isset($_POST['sessionID'])) $sessionID = $_POST['sessionID'];
										else $sessionID = $_GET['sessionID'];
								  		$getSession = "SELECT * FROM session WHERE sessionID=?";
								    	$session = $mysqli->execute_query($getSession, [$sessionID])->fetch_assoc();
								    	print 'session ID - '; echo $sessionID; print '<br />';
								    	print 'subject - '; echo stripslashes($session['subject']); print '<br />';
								    	print 'objectives - '; echo stripslashes($session['objectives']); print '<br />';
								    	// team
								    	require('accountsdb.php');
										$getTeam = "SELECT teamName FROM ttteam WHERE teamID =?";
			        					$team = $mysqli->execute_query($getTeam, [$session['teamID']])->fetch_assoc();
								    	print 'team (ID) - '; echo $team['teamName']; print ' ('; echo $session['teamID']; print ')<br />';
								    	// plan
								    	print 'scheduled date, time, duration - '; echo $session['year']; print '-';
								    	echo $session['month']; print '-';
								    	echo $session['day']; print ' ';
								    	echo $session['hour']; print ':';
								    	echo $session['minute']; print ' ';
								    	echo $session['ampm']; print ' ';
								    	echo $session['zone']; print ' ';
								    	echo $session['duration_hours']; print ':';
								    	echo $session['duration_minutes']; print '<br />';
								    	// entries
								    	require('quipx/qxdb.php');
								    	$getEntries = "SELECT discussID FROM session_discuss WHERE sessionID=?";
								    	$entries = $mysqli->execute_query($getEntries, [$sessionID])->fetch_all(MYSQLI_ASSOC);
								    	print 'discussion entries - '; echo count($entries); print '<br />';
								    	$getReflect = "SELECT reflectSelectID FROM reflect_select WHERE sessionID=?";
								    	$reflect = $mysqli->execute_query($getReflect, [$sessionID])->fetch_all(MYSQLI_ASSOC);
								    	print 'reflections - '; echo count($reflect); print '<br />';
								    	if (count($entries) > 0) {
			        						print 'Check the status of the discussion before deleting session. <br />';
			        					}
			        					print '<br />';
			        					// delete check
			        					if ($_GET['delete'] == "check") {
			        						print '<div style="text-align:center">
			        						Delete this session and all associated data?<br />
        									<a href="control.php?action=quipx&sessionID='.$sessionID.'&delete=yes" class="textlink">yes, delete</a> | 
        									<a href="control.php?action=quipx&sessionID='.$sessionID.'" class="textlink">no, cancel</a> 
        									</div>';
			        					}
			        					// delete session and associated data
			        					elseif ($_GET['delete'] == "yes") {
			        						$stmt = $mysqli->prepare("DELETE FROM session WHERE sessionID=?");
							  				$stmt->bind_param("i", $sessionID);
							  				$stmt->execute();
							  				$stmt->close();
							  				$stmt = $mysqli->prepare("DELETE FROM session_discuss WHERE sessionID=?");
							  				$stmt->bind_param("i", $sessionID);
							  				$stmt->execute();
							  				$stmt->close();
							  				$stmt = $mysqli->prepare("DELETE FROM reflect_select WHERE sessionID=?");
							  				$stmt->bind_param("i", $sessionID);
							  				$stmt->execute();
							  				$stmt->close();
							  				print 'session deleted<br /><br />';
			        					}
			        					// delete link
			        					else {
				        					print '<div style="text-align:center">
	    									<a href="control.php?action=quipx&sessionID='.$sessionID.'&delete=check" class="textlink">delete this session</a>   
	    									</div>';
									    	print '<br />';
									    }
									    print '<br />';
								  	}
									// sessions form
									print '<form action="control.php?action=quipx" method="post"> 
									<div class="fielddiv">
										<div class="fieldname">
											Session
										</div>
										<div class="fieldvalue">
											<select name="sessionID" class="inputtext" style="height:40px">'; 
												$getSessions = "SELECT sessionID, subject FROM session";
											    $sessions = $mysqli->execute_query($getSessions)->fetch_all(MYSQLI_ASSOC);
												foreach($sessions as $session_key => $session) {
													print '<option value='.$session['sessionID'].'>'.stripslashes($session['subject']).'</option>';
											  	}
											print '</select>
										</div>
									</div>
									<div class="fielddiv"">
										<div class="fieldname">
										
										</div>
										<div class="fieldvalue">
											<input type="submit" name="submit" class="submitbutton" value="Submit" />
										</div>
									</div>
							      	</form>';
								}
								// ================ woi templates/games =================
								if ($_GET['action'] == "woi" && !isset($_GET['userID'])) {
									print 'Web of Inquiry Information<br /><br />';
									require "webofinquiry/woidb.php";
									if (isset($_POST['template_id']) || isset($_GET['template_id'])) {
										if (isset($_POST['template_id'])) $template_id = $_POST['template_id'];
										else $template_id = $_GET['template_id'];
										// update category, subjects
										if ($_GET['edit'] == "update") {
											$stmt = $mysqli->prepare("UPDATE template SET template_category=? WHERE template_id=?");
											$stmt->bind_param('si', $_POST['template_category'], $_GET['template_id']);
											$stmt->execute();
											$stmt->close();
											$stmt = $mysqli->prepare("DELETE FROM template_subject WHERE template_id=?");
							  				$stmt->bind_param("i", $_GET['template_id']);
							  				$stmt->execute();
							  				$stmt->close();
											foreach ($_POST['subjectID'] as $subjectID) {
							  					$stmt = $mysqli->prepare("INSERT INTO template_subject (template_id, subjectID) VALUES (?,?)");
				  								$stmt->bind_param("ii", $_GET['template_id'], $subjectID);
				  								$stmt->execute();
				  								$stmt->close();
							  				}
										}
										// display
										$getTemplate = "SELECT template_name, template_modified, template_public, template_object, template_category FROM template WHERE template_id =?";
			        					$template = $mysqli->execute_query($getTemplate, [$template_id])->fetch_assoc();
			        					print 'template ID - '; echo $template_id; print '<br />';
			        					print 'name - '; echo stripslashes($template['template_name']); print '<br />';
			        					print 'object - '; echo stripslashes($template['template_object']); print '<br />';
			        					print 'created/modified - '; echo $template['template_modified']; print '<br />';
			        					print 'public (1=yes) - '; echo $template['template_public']; print '<br />';
			        					// rules, moves, levels
			        					$getRules = "SELECT rule_id FROM template_rule WHERE template_id=? AND rule <>''";
							  			$rules = $mysqli->execute_query($getRules, [$template_id])->fetch_all(MYSQLI_ASSOC);
							  			print 'rules - '; echo count($rules); print '<br />';
							  			$getMoves = "SELECT move_id FROM template_move WHERE template_id=? AND move <>''";
							  			$moves = $mysqli->execute_query($getMoves, [$template_id])->fetch_all(MYSQLI_ASSOC);
							  			print 'moves - '; echo count($moves); print '<br />';
							  			$getLevels = "SELECT level_id FROM template_level WHERE template_id=? AND level_name<>''";
										$levels = $mysqli->execute_query($getLevels, [$template_id])->fetch_all(MYSQLI_ASSOC);
										print 'levels - '; echo count($levels); print '<br />';
			        					// games
			        					$getGames = "SELECT game_id FROM game WHERE template_id =?";
			        					$games = $mysqli->execute_query($getGames, [$template_id])->fetch_all(MYSQLI_ASSOC);
			        					print 'games - '; echo count($games); print '<br />';
			        					if (count($games) > 0) {
			        						print 'Check the status of these games before deleting template. <br />';
			        					}
			        					// category and subjects
			        					print 'category - '; echo $template['template_category']; print '<br />';
			        					$getSubjects = "SELECT subjectID FROM template_subject WHERE template_id =?";
			        					$subjects = $mysqli->execute_query($getSubjects, [$template_id])->fetch_all(MYSQLI_ASSOC);
			        					print 'subjects - '; echo count($subjects); print '<br />';
			        					// delete check
			        					if ($_GET['delete'] == "check") {
			        						print '<div style="text-align:center">';
			        						print '<br />Delete this template?<br />
        									<a href="control.php?action=woi&template_id='.$template_id.'&delete=yes" class="textlink">yes, delete</a> | 
        									<a href="control.php?action=woi&template_id='.$template_id.'" class="textlink">no, cancel</a> ';
        									print '</div>';
			        					}
			        					// delete template and associated data
			        					elseif ($_GET['delete'] == "yes") {
			        						// template, level, move, rule, tool, subject
			        						require "webofinquiry/woidb.php";
											$stmt = $mysqli->prepare("DELETE FROM template WHERE template_id=?");
							  				$stmt->bind_param("i", $template_id);
							  				$stmt->execute();
							  				$stmt->close();
							  				$stmt = $mysqli->prepare("DELETE FROM template_level WHERE template_id=?");
							  				$stmt->bind_param("i", $template_id);
							  				$stmt->execute();
							  				$stmt->close();
							  				$stmt = $mysqli->prepare("DELETE FROM template_move WHERE template_id=?");
							  				$stmt->bind_param("i", $template_id);
							  				$stmt->execute();
							  				$stmt->close();
							  				$stmt = $mysqli->prepare("DELETE FROM template_rule WHERE template_id=?");
							  				$stmt->bind_param("i", $template_id);
							  				$stmt->execute();
							  				$stmt->close();
							  				$stmt = $mysqli->prepare("DELETE FROM template_subject WHERE template_id=?");
							  				$stmt->bind_param("i", $template_id);
							  				$stmt->execute();
							  				$stmt->close();
							  				print '<br />template deleted<br />';
			        					}
			        					// edit form
			        					elseif ($_GET['edit'] == "form") {
			        						print '<br />edit category, subjects<br /><br />';
			        						print '<form action="control.php?action=woi&template_id='.$template_id.'&edit=update"" method="post"> 
			        							<div class="fielddiv">
													<div class="fieldname">
														Template category
													</div>
													<div class="fieldvalue">';
														if ($template['template_category'] == "structural") print '<input name="template_category" type="radio" value="structural" checked /> structural'; 
														else print '<input name="template_category" type="radio" value="structural" /> structural';
														if ($template['template_category'] == "functional") print '<input name="template_category" type="radio" value="functional" checked /> functional'; 
														else print '<input name="template_category" type="radio" value="functional" /> functional';
														if ($template['template_category'] == "process") print '<input name="template_category" type="radio" value="process" checked /> process'; 
														else print '<input name="template_category" type="radio" value="process" /> process';
													print '</div>
												</div>
												<div class="fielddiv">
													<div class="fieldname">
														Template subjects
													</div>
													<div class="fieldvalue">';
														$getSubjects = "SELECT * FROM subject ORDER by domain ASC, subject ASC";
								        				$subjects = $mysqli->execute_query($getSubjects)->fetch_all(MYSQLI_ASSOC);
														foreach ($subjects as $subjects_key => $subject) {
															$checkSubject = "SELECT subjectID FROM template_subject WHERE template_id=? AND subjectID =?";
			        										$check = $mysqli->execute_query($checkSubject, [$_GET['template_id'], $subject['subjectID']])->fetch_assoc();
			        										if (!empty($check)) $checked = 'checked';
				  											else $checked = '';
			        										print '<input name="subjectID[]" type="checkbox" value='.$subject['subjectID'].' '.$checked.' /> '; 
															echo $subject['domain']; print ': ';
															echo $subject['subject']; print '<br />';
														}
													print '</div>
												</div>
												<div class="fielddiv"">
													<div class="fieldname">
													
													</div>
													<div class="fieldvalue">
														<input type="submit" name="submit" class="submitbutton" value="Submit" />
													</div>
												</div>
			        						</form>';
			        					}
			        					// delete edit links
			        					else {
			        						print '<div style="text-align:center">
        									<a href="control.php?action=woi&template_id='.$template_id.'&delete=check" class="textlink">delete this template</a> | 
        									<a href="control.php?action=woi&template_id='.$template_id.'&edit=form" class="textlink">edit category and subjects</a> 
        									</div>';
        								}
			        					print '<br />';
									}
									// games
									if (isset($_GET['game_id']) || isset($_POST['game_id'])) {
										require "webofinquiry/woidb.php";
										if (isset($_POST['game_id'])) $game_id = $_POST['game_id'];
										else $game_id = $_GET['game_id'];
										$getGame= "SELECT template_id, teamID, game_start, game_name, game_description, game_public, game_complete FROM game WHERE game_id =?";
			        					$game = $mysqli->execute_query($getGame, [$game_id])->fetch_assoc();
			        					print 'game ID - '; echo $game_id; print '<br />';
			        					print 'name - '; echo stripslashes($game['game_name']); print '<br />';
			        					print 'description - '; echo stripslashes($game['game_description']); print '<br />';
			        					print 'started - '; echo $game['game_start']; print '<br />';
			        					print 'public (1=yes) - '; echo $game['game_public']; print '<br />';
			        					// template
			        					$getTemplate = "SELECT template_name FROM template WHERE template_id =?";
			        					$template = $mysqli->execute_query($getTemplate, [$game['template_id']])->fetch_assoc();
			        					print 'template - '; echo stripslashes($template['template_name']); print '<br />';
			        					// team
			        					require('accountsdb.php');
										$getTeam = "SELECT teamName FROM ttteam WHERE teamID =?";
			        					$team = $mysqli->execute_query($getTeam, [$game['teamID']])->fetch_assoc();
			        					print 'team (ID) - '; echo $team['teamName']; print ' ('; echo $game['teamID']; print ')<br />';
			        					// turns
			        					require "webofinquiry/woidb.php";
			        					$getTurns = "SELECT * FROM turn WHERE game_id=?";
										$turns = $mysqli->execute_query($getTurns, [$game_id])->fetch_all(MYSQLI_ASSOC);
										$turnCount = count($turns);
			        					print 'turns taken - '; echo $turnCount; print '<br />';
			        					if ($turnCount > 0) print 'Check the status of the game and turns before deleting. <br /><br />';
			        					// delete check
			        					if ($_GET['delete'] == "check") {
			        						print '<div style="text-align:center">
			        						Delete this game?<br />
        									<a href="control.php?action=woi&game_id='.$game_id.'&delete=yes" class="textlink">yes, delete</a> | 
        									<a href="control.php?action=woi&game_id='.$game_id.'" class="textlink">no, cancel</a> 
        									</div>';
			        					}
			        					// delete game and associated data
			        					elseif ($_GET['delete'] == "yes") {
			        						require "webofinquiry/woidb.php";
							  				// turns, text 
							  				$getTurns = "SELECT turn_id FROM turn WHERE game_id=?";
											$turns = $mysqli->execute_query($getTurns, [$game_id])->fetch_all(MYSQLI_ASSOC);
											foreach ($turns as $turns_key => $turn) {
												$getTurnText = "SELECT turn_text_id FROM turn_text WHERE turn_id=?";
												$turnText = $mysqli->execute_query($getTurnText, [$turn['turn_id']])->fetch_assoc();
												$stmt = $mysqli->prepare("DELETE FROM turn_text WHERE turn_text_id=?");
								  				$stmt->bind_param("i", $turnText['turn_text_id']);
								  				$stmt->execute();
								  				$stmt->close();
												$stmt = $mysqli->prepare("DELETE FROM turn WHERE turn_id=?");
								  				$stmt->bind_param("i", $turn['turn_id']);
								  				$stmt->execute();
								  				$stmt->close();
											}
											//game
											$stmt = $mysqli->prepare("DELETE FROM game WHERE game_id=?");
							  				$stmt->bind_param("i", $game_id);
							  				$stmt->execute();
							  				$stmt->close();
							  				print 'game deleted<br />';
			        					}
			        					// delete link
			        					else {
			        						print '<div style="text-align:center">
        									<a href="control.php?action=woi&game_id='.$game_id.'&delete=check" class="textlink">delete this game</a> 
        									</div>';
        								}
			        					print '<br />';
									}
									// templates form
									print '<form action="control.php?action=woi" method="post"> 
									<div class="fielddiv">
										<div class="fieldname">
											Template
										</div>
										<div class="fieldvalue">
											<select name="template_id" class="inputtext" style="height:40px">'; 
												$getTemplates = "SELECT template_id, template_name FROM template ORDER BY template_name ASC";
						        				$templates = $mysqli->execute_query($getTemplates)->fetch_all(MYSQLI_ASSOC);
												foreach ($templates as $templates_key => $template) {
													print '<option value='.$template['template_id'].'>'.stripslashes($template['template_name']).'</option>';
												}
											print '</select>
										</div>
									</div>
									<div class="fielddiv"">
										<div class="fieldname">
										
										</div>
										<div class="fieldvalue">
											<input type="submit" name="submit" class="submitbutton" value="Submit" />
										</div>
									</div>
							      	</form>';
									print '<br />';
									// games form
									print '<form action="control.php?action=woi" method="post"> 
									<div class="fielddiv">
										<div class="fieldname">
											Game
										</div>
										<div class="fieldvalue">
											<select name="game_id" class="inputtext" style="height:40px">'; 
												$getGames = "SELECT game_id, game_name FROM game ORDER BY game_name ASC";
			        							$games = $mysqli->execute_query($getGames)->fetch_all(MYSQLI_ASSOC);
												foreach ($games as $games_key => $game) {
													print '<option value='.$game['game_id'].'>'.stripslashes($game['game_name']).'</option>';
												}
											print '</select>
										</div>
									</div>
									<div class="fielddiv"">
										<div class="fieldname">
										
										</div>
										<div class="fieldvalue">
											<input type="submit" name="submit" class="submitbutton" value="Submit" />
										</div>
									</div>
							      	</form>';
								}
								// ================================= orgs teams messages ==============================================
								if ($_GET['action'] == "messages" && !isset($_GET['userID'])) {
									if (isset($_POST['messageID']) || isset($_GET['messageID'])) {
								  		if (isset($_POST['messageID'])) $messageID = $_POST['messageID'];
								  		else $messageID = $_GET['messageID'];
								  		require('accountsdb.php');
								  		$getMessage = "SELECT * FROM message WHERE messageID=?";
										$message = $mysqli->execute_query($getMessage, [$messageID])->fetch_assoc();
										print 'Message Information<br /><br />';
										print 'subject - '; echo stripslashes($message['subject']); print '<br />';
										print 'sender name - '; echo stripslashes($message['senderName']); print '<br />';
										print 'sent time - '; echo $message['sentTime']; print '<br />';
										print 'message - '; echo stripslashes($message['message']); print '<br />';
										print 'to individual userID  - '; echo $message['recInd']; print '<br />';
										print 'to team teamID  - '; echo $message['recTeam']; print '<br />';
										print 'to org orgID - '; echo $message['recOrg']; print '<br />';
										print 'to all admin 100  - '; echo $message['recAll']; print '<br />';
										print 'to woi game_id  - '; echo $message['game_id']; print '<br />';
										print 'to quipx sessionID  - '; echo $message['sessionID']; print '<br />';
										print '<br />';
										// delete check
			        					if ($_GET['delete'] == "check") {
			        						print '<div style="text-align:center">
			        						Delete this message?<br />
	    									<a href="control.php?action=messages&messageID='.$messageID.'&delete=yes" class="textlink">yes, delete</a> | 
	    									<a href="control.php?action=messages&messageID='.$messageID.'" class="textlink">no, cancel</a> <br /> 
	    									</div>';
			        					}
			        					// delete
			        					elseif ($_GET['delete'] == "yes") {
			        						$stmt = $mysqli->prepare("DELETE FROM message WHERE messageID=?");
							  				$stmt->bind_param("i", $_GET['messageID']);
							  				$stmt->execute();
							  				$stmt->close();
							  				print 'message deleted<br /><br /> ';
			        					}
			        					// delete link
			        					else {
			        						print '<div style="text-align:center">
		    								<a href="control.php?action=messages&messageID='.$messageID.'&delete=check" class="textlink">delete this message</a><br />
		    								</div>';
			        					}
								  	}
									print 'Message Select<br /><br />';
									require('accountsdb.php');
									print '<form action="control.php?action=messages" method="post"> 
									<div class="fielddiv">
										<div class="fieldname">
											Message
										</div>
										<div class="fieldvalue">
											<select name="messageID" class="inputtext" style="height:40px">'; 
												$getMessages = "SELECT messageID, subject, sentTime, senderName FROM message ORDER BY messageID ASC";
						        				$messages = $mysqli->execute_query($getMessages)->fetch_all(MYSQLI_ASSOC);
												foreach ($messages as $messages_key => $message) {
													print '<option value='.$message['messageID'].'>'.stripslashes($message['subject']).' ('.$message['senderName'].' '.$message['sentTime'].')</option>';
												}
											print '</select>
										</div>
									</div>
									<div class="fielddiv"">
										<div class="fieldname">
										
										</div>
										<div class="fieldvalue">
											<input type="submit" name="submit" class="submitbutton" value="Submit" />
										</div>
									</div>
							      	</form>';
								}
								// =============== teams ===================
								if ($_GET['action'] == "teams" && (isset($_POST['teamID']) || isset($_GET['teamID'])) && !isset($_GET['userID'])) {
									if (isset($_POST['teamID'])) $teamID = $_POST['teamID'];
									else $teamID = $_GET['teamID'];
									print 'Team Information<br /><br />';
									require('accountsdb.php');
									$getTeam = "SELECT * FROM ttteam WHERE teamID =?";
		        					$team = $mysqli->execute_query($getTeam, [$teamID])->fetch_assoc();
		        					print 'team ID - '; echo $team['teamID']; print '<br />';
		        					print 'name - '; echo stripslashes($team['teamName']); print '<br />';
		        					print 'admin/creator (userID) - '; echo $team['userID']; print '<br />';
		        					print 'org (orgID) - '; echo $team['orgID']; print '<br />';
		        					print 'created - '; echo $team['teamCreated']; print '<br />';
		        					$getTeamMems = "SELECT userID FROM ttteam_mem WHERE teamID =?";
		        					$mems = $mysqli->execute_query($getTeamMems, [$teamID])->fetch_all(MYSQLI_ASSOC);
		        					print 'members - '; echo count($mems); print '<br />';
		        					require('webofinquiry/woidb.php');
		        					$getGames = "SELECT game_id FROM game WHERE teamID =?";
			        				$games = $mysqli->execute_query($getGames, [$teamID])->fetch_all(MYSQLI_ASSOC);
			        				print 'WoI games - '; echo count($games); print '<br />';
			        				require('quipx/qxdb.php');
		        					$getSessions = "SELECT sessionID FROM session WHERE teamID =?";
			        				$sessions = $mysqli->execute_query($getSessions, [$teamID])->fetch_all(MYSQLI_ASSOC);
			        				print 'Quipx sessions - '; echo count($sessions); print '<br />';
			        				print '(If this team has games or sessions, review them before deleting team.)<br /><br />';
			        				require('accountsdb.php');
		        					// delete check
		        					if ($_GET['delete'] == "check") {
		        						print '<div style="text-align:center">';
		        						print 'Delete this team? <br />
		        						<a href="control.php?action=teams&teamID='.$teamID.'&delete=yes" class="textlink">Yes</a> | 
		        						<a href="control.php?action=teams" class="textlink">No, cancel</a>
		        						</div>';
		        						print '<br />';
		        					}
		        					elseif ($_GET['delete'] == "yes") {
	        							$stmt = $mysqli->prepare("DELETE FROM ttteam_mem WHERE teamID=?");
		  								$stmt->bind_param('i', $teamID);
		  								$stmt->execute();
		  								$stmt->close();
										$stmt = $mysqli->prepare("DELETE FROM ttteam WHERE teamID=?");
		  								$stmt->bind_param('i', $teamID);
		  								$stmt->execute();
		  								$stmt->close();
		  								print 'deleted team<br /><br />';
		        					}
		        					// delete link
		        					else {
		        						print 'Deleting this team will also delete any team members\' association with this team.
		        						It will not delete any users, games, or sessions.';
		        						print '<div style="text-align:center">
	    								<a href="control.php?action=teams&teamID='.$teamID.'&delete=check" class="textlink">Delete this team</a> 
	    								</div>';
	    								print '<br />';
		        					}
		        				}
								if ($_GET['action'] == "teams" && !isset($_GET['userID'])) {
									print 'Team Select<br /><br />';
									require('accountsdb.php');
									print '<form action="control.php?action=teams" method="post"> 
									<div class="fielddiv">
										<div class="fieldname">
											Team
										</div>
										<div class="fieldvalue">
											<select name="teamID" class="inputtext" style="height:40px">'; 
												$getTeams = "SELECT teamID, teamName FROM ttteam ORDER BY teamName ASC";
						        				$teams = $mysqli->execute_query($getTeams)->fetch_all(MYSQLI_ASSOC);
												foreach ($teams as $teams_key => $team) {
													print '<option value='.$team['teamID'].'>'.stripslashes($team['teamName']).'</option>';
												}
											print '</select>
										</div>
									</div>
									<div class="fielddiv"">
										<div class="fieldname">
										
										</div>
										<div class="fieldvalue">
											<input type="submit" name="submit" class="submitbutton" value="Submit" />
										</div>
									</div>
							      	</form>';
							    }
								// =============== orgs ===================
								if ($_GET['action'] == "orgs" && (isset($_POST['orgID']) || isset($_GET['orgID'])) && !isset($_GET['userID'])) {
									if (isset($_POST['orgID'])) $orgID = $_POST['orgID'];
									else $orgID = $_GET['orgID'];
									print 'Org Information<br /><br />';
									require('accountsdb.php');
									$getOrg = "SELECT * FROM ttorg WHERE orgID =?";
		        					$org = $mysqli->execute_query($getOrg, [$orgID])->fetch_assoc();
		        					print 'org ID - '; echo $org['orgID']; print '<br />';
		        					print 'name - '; echo stripslashes($org['orgName']); print '<br />';
		        					print 'admin/creator (userID) - '; echo $org['userID']; print '<br />';
		        					print 'created - '; echo $org['orgCreated']; print '<br />';
		        					$getOrgMems = "SELECT userID FROM ttorg_mem WHERE orgID =?";
		        					$mems = $mysqli->execute_query($getOrgMems, [$orgID])->fetch_all(MYSQLI_ASSOC);
		        					print 'members - '; echo count($mems); print '<br />';
		        					$getOrgTeams = "SELECT teamID FROM ttteam WHERE orgID =?";
		        					$teams = $mysqli->execute_query($getOrgTeams, [$orgID])->fetch_all(MYSQLI_ASSOC);
		        					print 'teams - '; echo count($teams); print '<br />';
		        					print '(If this org has any teams, review them before deleting org.)<br /><br />';
		        					// delete check
		        					if ($_GET['delete'] == "check") {
		        						print '<div style="text-align:center">';
		        						print 'Delete this org? <br />
		        						<a href="control.php?action=orgs&orgID='.$orgID.'&delete=yes" class="textlink">Yes</a> | 
		        						<a href="control.php?action=orgs" class="textlink">No, cancel</a>
		        						</div>';
		        					}
		        					elseif ($_GET['delete'] == "yes") {
	        							$stmt = $mysqli->prepare("DELETE FROM ttorg_mem WHERE orgID=?");
		  								$stmt->bind_param('i', $orgID);
		  								$stmt->execute();
		  								$stmt->close();
		  								$stmt = $mysqli->prepare("UPDATE ttteam SET orgID=0 WHERE orgID=?");
										$stmt->bind_param('i', $orgID);
										$stmt->execute();
										$stmt->close();
										$stmt = $mysqli->prepare("DELETE FROM ttorg WHERE orgID=?");
		  								$stmt->bind_param('i', $orgID);
		  								$stmt->execute();
		  								$stmt->close();
		  								print 'deleted org<br />';
		        					}
		        					// delete link
		        					else {
		        						print 'Deleting this org will also delete any teams\' and team members\' association with this org.
		        						It will not delete any teams, users, games, or sessions.';
		        						print '<div style="text-align:center">
	    								<a href="control.php?action=orgs&orgID='.$orgID.'&delete=check" class="textlink">Delete this org</a> 
	    								</div>';
		        					}
		        					print '<br />';
								}
								if ($_GET['action'] == "orgs" && !isset($_GET['userID'])) {
									print 'Org Select<br /><br />';
									require('accountsdb.php');
									print '<form action="control.php?action=orgs" method="post"> 
									<div class="fielddiv">
										<div class="fieldname">
											Org
										</div>
										<div class="fieldvalue">
											<select name="orgID" class="inputtext" style="height:40px">'; 
												$getOrgs = "SELECT orgID, orgName FROM ttorg ORDER BY orgName ASC";
						        				$orgs = $mysqli->execute_query($getOrgs)->fetch_all(MYSQLI_ASSOC);
												foreach ($orgs as $orgs_key => $org) {
													print '<option value='.$org['orgID'].'>'.stripslashes($org['orgName']).'</option>';
												}
											print '</select>
										</div>
									</div>
									<div class="fielddiv"">
										<div class="fieldname">
										
										</div>
										<div class="fieldvalue">
											<input type="submit" name="submit" class="submitbutton" value="Submit" />
										</div>
									</div>
							      	</form>';
							    }
								// ================================= user ==============================================
								// ================ messages by user =================
								if ($_GET['action'] == "messages" && isset($_GET['userID'])) {
									print 'Messages (user is sender)<br /><br />';
									//get username
									require('accountsdb.php');
									$getUser = "SELECT username FROM ttuser WHERE userID =?";
			        				$user = $mysqli->execute_query($getUser, [$_GET['userID']])->fetch_assoc();
									print 'Username <br />'; echo $user['username']; print '<br /><br />';
									// session
								  	if (isset($_GET['messageID'])) {
								  		$getMessage = "SELECT * FROM message WHERE messageID=?";
										$message = $mysqli->execute_query($getMessage, [$_GET['messageID']])->fetch_assoc();
										print 'subject - '; echo stripslashes($message['subject']); print '<br />';
										print 'sender name - '; echo stripslashes($message['senderName']); print '<br />';
										print 'sent time - '; echo $message['sentTime']; print '<br />';
										print 'message - '; echo stripslashes($message['message']); print '<br />';
										print 'to individual userID  - '; echo $message['recInd']; print '<br />';
										print 'to team teamID  - '; echo $message['recTeam']; print '<br />';
										print 'to org orgID - '; echo $message['recOrg']; print '<br />';
										print 'to all admin 100  - '; echo $message['recAll']; print '<br />';
										print 'to woi game_id  - '; echo $message['game_id']; print '<br />';
										print 'to quipx sessionID  - '; echo $message['sessionID']; print '<br />';
										print '<br />';
										// delete check
			        					if ($_GET['delete'] == "check") {
			        						print '<div style="text-align:center">
			        						Delete this message?<br />
	    									<a href="control.php?action=messages&messageID='.$_GET['messageID'].'&userID='.$_GET['userID'].'&delete=yes" class="textlink">yes, delete</a> | 
	    									<a href="control.php?action=messages&messageID='.$_GET['messageID'].'&userID='.$_GET['userID'].'" class="textlink">no, cancel</a> 
	    									</div>';
			        					}
			        					// delete
			        					elseif ($_GET['delete'] == "yes") {
			        						$stmt = $mysqli->prepare("DELETE FROM message WHERE messageID=?");
							  				$stmt->bind_param("i", $_GET['messageID']);
							  				$stmt->execute();
							  				$stmt->close();
							  				print 'message deleted<br />';
			        					}
			        					// delete link
			        					else {
			        						print '<div style="text-align:center">
		    								<a href="control.php?action=messages&messageID='.$_GET['messageID'].'&userID='.$_GET['userID'].'&delete=check" class="textlink">delete this message</a>   
		    								</div>';
			        					}
								  	}
		        					print '<br />';
									// all messages
									$getMessages = "SELECT messageID, subject, sentTime FROM message WHERE senderID=? ORDER BY messageID DESC";
									$messages = $mysqli->execute_query($getMessages, [$_GET['userID']])->fetch_all(MYSQLI_ASSOC);
									if (!empty($messages)) {
										foreach($messages as $message) {
											print '<a href="control.php?action=messages&userID='.$_GET['userID'].'&messageID='.$message['messageID'].'" class="textlink">'.$message['subject'].' '.$message['sentTime'].'</a><br />';
										}
									}
									print '<br />';
								}
								// ================ quipx sessions by user =================
								if ($_GET['action'] == "quipx" && isset($_GET['userID'])) {
									print 'Quipx Information (user is admin)<br /><br />';
									//get username
									require('accountsdb.php');
									$getUser = "SELECT username FROM ttuser WHERE userID =?";
			        				$user = $mysqli->execute_query($getUser, [$_GET['userID']])->fetch_assoc();
									print 'Username <br />'; echo $user['username']; print '<br /><br />';
									// selected session
									require('quipx/qxdb.php');
									// session
								  	if (isset($_GET['sessionID'])) {
								  		$getSession = "SELECT * FROM session WHERE sessionID=?";
								    	$session = $mysqli->execute_query($getSession, [$_GET['sessionID']])->fetch_assoc();
								    	print 'session ID - '; echo $_GET['sessionID']; print '<br />';
								    	print 'subject - '; echo stripslashes($session['subject']); print '<br />';
								    	print 'objectives - '; echo stripslashes($session['objectives']); print '<br />';
								    	// team
								    	require('accountsdb.php');
										$getTeam = "SELECT teamName FROM ttteam WHERE teamID =?";
			        					$team = $mysqli->execute_query($getTeam, [$session['teamID']])->fetch_assoc();
								    	print 'team (ID) - '; echo $team['teamName']; print ' ('; echo $session['teamID']; print ')<br />';
								    	// plan
								    	print 'scheduled date, time, duration - '; echo $session['year']; print '-';
								    	echo $session['month']; print '-';
								    	echo $session['day']; print ' ';
								    	echo $session['hour']; print ':';
								    	echo $session['minute']; print ' ';
								    	echo $session['ampm']; print ' ';
								    	echo $session['zone']; print ' ';
								    	echo $session['duration_hours']; print ':';
								    	echo $session['duration_minutes']; print '<br />';
								    	// entries
								    	require('quipx/qxdb.php');
								    	$getEntries = "SELECT discussID FROM session_discuss WHERE sessionID=?";
								    	$entries = $mysqli->execute_query($getEntries, [$_GET['sessionID']])->fetch_all(MYSQLI_ASSOC);
								    	print 'discussion entries - '; echo count($entries); print '<br />';
								    	$getReflect = "SELECT reflectSelectID FROM reflect_select WHERE sessionID=?";
								    	$reflect = $mysqli->execute_query($getReflect, [$_GET['sessionID']])->fetch_all(MYSQLI_ASSOC);
								    	print 'reflections - '; echo count($reflect); print '<br />';
								    	if (count($entries) > 0) {
			        						print '(Check the status of the discussion before deleting session.) <br />';
			        					}
			        					print '<br />';
			        					// delete check
			        					if ($_GET['delete'] == "check") {
			        						print '<div style="text-align:center">
			        						Delete this session and all associated data?<br />
        									<a href="control.php?action=quipx&sessionID='.$_GET['sessionID'].'&userID='.$_GET['userID'].'&delete=yes" class="textlink">yes, delete</a> | 
        									<a href="control.php?action=quipx&sessionID='.$_GET['sessionID'].'&userID='.$_GET['userID'].'" class="textlink">no, cancel</a> 
        									</div>';
			        					}
			        					// delete session and associated data
			        					elseif ($_GET['delete'] == "yes") {
			        						$stmt = $mysqli->prepare("DELETE FROM session WHERE sessionID=?");
							  				$stmt->bind_param("i", $_GET['sessionID']);
							  				$stmt->execute();
							  				$stmt->close();
							  				$stmt = $mysqli->prepare("DELETE FROM session_discuss WHERE sessionID=?");
							  				$stmt->bind_param("i", $_GET['sessionID']);
							  				$stmt->execute();
							  				$stmt->close();
							  				$stmt = $mysqli->prepare("DELETE FROM reflect_select WHERE sessionID=?");
							  				$stmt->bind_param("i", $_GET['sessionID']);
							  				$stmt->execute();
							  				$stmt->close();
							  				print 'session deleted<br /><br />';
			        					}
			        					// delete link
			        					else {
				        					print '<div style="text-align:center">
	    									<a href="control.php?action=quipx&sessionID='.$_GET['sessionID'].'&userID='.$_GET['userID'].'&delete=check" class="textlink">delete this session</a>   
	    									</div>';
									    	print '<br />';
									    }
								  	}
									// all sessions
									$getSessions = "SELECT sessionID, subject FROM session WHERE userID=?";
								    $sessions = $mysqli->execute_query($getSessions, [$_GET['userID']])->fetch_all(MYSQLI_ASSOC);
								    if (!empty($sessions)) {
										foreach($sessions as $session_key => $session) {
										    $subject = stripslashes($session['subject']);
										    print '<a href="control.php?action=quipx&sessionID='.$session['sessionID'].'&userID='.$_GET['userID'].'" class="textlink">'.$subject.'</a><br />';
								  		}
								  	}
								  	else print 'no sessions<br />';
									print '<br />';
								}	
								// ================ woi templates/games by user =================
								if ($_GET['action'] == "woi" && isset($_GET['userID'])) {
									print 'Web of Inquiry Information (user is admin)<br /><br />';
									//get username
									require('accountsdb.php');
									$getUser = "SELECT username FROM ttuser WHERE userID =?";
			        				$user = $mysqli->execute_query($getUser, [$_GET['userID']])->fetch_assoc();
									print 'Username <br />'; echo $user['username']; print '<br /><br />';
									// selected template or game
									if (isset($_GET['template_id'])) {
										require "webofinquiry/woidb.php";
										// update category, subjects
										if ($_GET['edit'] == "update") {
			  								$stmt = $mysqli->prepare("UPDATE template SET template_category=? WHERE template_id=?");
											$stmt->bind_param('si', $_POST['template_category'], $_GET['template_id']);
											$stmt->execute();
											$stmt->close();
											$stmt = $mysqli->prepare("DELETE FROM template_subject WHERE template_id=?");
							  				$stmt->bind_param("i", $_GET['template_id']);
							  				$stmt->execute();
							  				$stmt->close();
											foreach ($_POST['subjectID'] as $subjectID) {
							  					$stmt = $mysqli->prepare("INSERT INTO template_subject (template_id, subjectID) VALUES (?,?)");
				  								$stmt->bind_param("ii", $_GET['template_id'], $subjectID);
				  								$stmt->execute();
				  								$stmt->close();
							  				}
										}
										// template values
										$getTemplate = "SELECT template_name, template_modified, template_public, template_object, template_category FROM template WHERE template_id =?";
			        					$template = $mysqli->execute_query($getTemplate, [$_GET['template_id']])->fetch_assoc();
			        					print 'template ID - '; echo $_GET['template_id']; print '<br />';
			        					print 'name - '; echo stripslashes($template['template_name']); print '<br />';
			        					print 'object - '; echo stripslashes($template['template_object']); print '<br />';
			        					print 'created/modified - '; echo $template['template_modified']; print '<br />';
			        					print 'public (1=yes) - '; echo $template['template_public']; print '<br />';
			        					// rules, moves, levels
			        					$getRules = "SELECT rule_id FROM template_rule WHERE template_id=? AND rule <>''";
							  			$rules = $mysqli->execute_query($getRules, [$_GET['template_id']])->fetch_all(MYSQLI_ASSOC);
							  			print 'rules - '; echo count($rules); print '<br />';
							  			$getMoves = "SELECT move_id FROM template_move WHERE template_id=? AND move <>''";
							  			$moves = $mysqli->execute_query($getMoves, [$_GET['template_id']])->fetch_all(MYSQLI_ASSOC);
							  			print 'moves - '; echo count($moves); print '<br />';
							  			$getLevels = "SELECT level_id FROM template_level WHERE template_id=? AND level_name<>''";
										$levels = $mysqli->execute_query($getLevels, [$_GET['template_id']])->fetch_all(MYSQLI_ASSOC);
										print 'levels - '; echo count($levels); print '<br />';
			        					// games
			        					$getGames = "SELECT game_id FROM game WHERE template_id =?";
			        					$games = $mysqli->execute_query($getGames, [$_GET['template_id']])->fetch_all(MYSQLI_ASSOC);
			        					print 'games - '; echo count($games); print '<br />';
			        					if (count($games) > 0) {
			        						print '(Check the status of these games before deleting template.) <br />';
			        					}
			        					// category and subjects
			        					print 'category - '; echo $template['template_category']; print '<br />';
			        					$getSubjects = "SELECT subjectID FROM template_subject WHERE template_id =?";
			        					$subjects = $mysqli->execute_query($getSubjects, [$_GET['template_id']])->fetch_all(MYSQLI_ASSOC);
			        					print 'subjects - '; echo count($subjects); print '<br />';
			        					// delete check
			        					if ($_GET['delete'] == "check") {
			        						print '<div style="text-align:center">';
			        						print '<br />Delete this template?<br />
        									<a href="control.php?action=woi&template_id='.$_GET['template_id'].'&userID='.$_GET['userID'].'&delete=yes" class="textlink">yes, delete</a> | 
        									<a href="control.php?action=woi&template_id='.$_GET['template_id'].'&userID='.$_GET['userID'].'" class="textlink">no, cancel</a> ';
        									print '</div>';
			        					}
			        					// delete template and associated data
			        					elseif ($_GET['delete'] == "yes") {
			        						// template, level, move, rule, tool, subject
			        						require "webofinquiry/woidb.php";
											$stmt = $mysqli->prepare("DELETE FROM template WHERE template_id=?");
							  				$stmt->bind_param("i", $_GET['template_id']);
							  				$stmt->execute();
							  				$stmt->close();
							  				$stmt = $mysqli->prepare("DELETE FROM template_level WHERE template_id=?");
							  				$stmt->bind_param("i", $_GET['template_id']);
							  				$stmt->execute();
							  				$stmt->close();
							  				$stmt = $mysqli->prepare("DELETE FROM template_move WHERE template_id=?");
							  				$stmt->bind_param("i", $_GET['template_id']);
							  				$stmt->execute();
							  				$stmt->close();
							  				$stmt = $mysqli->prepare("DELETE FROM template_rule WHERE template_id=?");
							  				$stmt->bind_param("i", $_GET['template_id']);
							  				$stmt->execute();
							  				$stmt->close();
							  				$stmt = $mysqli->prepare("DELETE FROM template_subject WHERE template_id=?");
							  				$stmt->bind_param("i", $_GET['template_id']);
							  				$stmt->execute();
							  				$stmt->close();
							  				print '<br />template deleted<br />';
			        					}
			        					// edit form
			        					elseif ($_GET['edit'] == "form") {
			        						print '<br />edit category, subjects<br /><br />';
			        						print '<form action="control.php?action=woi&template_id='.$_GET['template_id'].'&userID='.$_GET['userID'].'&edit=update"" method="post"> 
			        							<div class="fielddiv">
													<div class="fieldname">
														Template category
													</div>
													<div class="fieldvalue">';
														if ($template['template_category'] == "structural") print '<input name="template_category" type="radio" value="structural" checked /> structural'; 
														else print '<input name="template_category" type="radio" value="structural" /> structural';
														if ($template['template_category'] == "functional") print '<input name="template_category" type="radio" value="functional" checked /> functional'; 
														else print '<input name="template_category" type="radio" value="functional" /> functional';
														if ($template['template_category'] == "process") print '<input name="template_category" type="radio" value="process" checked /> process'; 
														else print '<input name="template_category" type="radio" value="process" /> process';
													print '</div>
												</div>
												<div class="fielddiv">
													<div class="fieldname">
														Template subjects
													</div>
													<div class="fieldvalue">';
														$getSubjects = "SELECT * FROM subject ORDER by domain ASC, subject ASC";
								        				$subjects = $mysqli->execute_query($getSubjects)->fetch_all(MYSQLI_ASSOC);
														foreach ($subjects as $subjects_key => $subject) {
															$checkSubject = "SELECT subjectID FROM template_subject WHERE template_id=? AND subjectID =?";
			        										$check = $mysqli->execute_query($checkSubject, [$_GET['template_id'], $subject['subjectID']])->fetch_assoc();
			        										if (!empty($check)) $checked = 'checked';
				  											else $checked = '';
			        										print '<input name="subjectID[]" type="checkbox" value='.$subject['subjectID'].' '.$checked.' /> '; 
															echo $subject['domain']; print ': ';
															echo $subject['subject']; print '<br />';
														}
													print '</div>
												</div>
												<div class="fielddiv"">
													<div class="fieldname">
													
													</div>
													<div class="fieldvalue">
														<input type="submit" name="submit" class="submitbutton" value="Submit" />
													</div>
												</div>
			        						</form>';
			        					}
			        					// delete edit links
			        					else {
			        						print '<div style="text-align:center">
        									<a href="control.php?action=woi&template_id='.$_GET['template_id'].'&userID='.$_GET['userID'].'&delete=check" class="textlink">delete this template</a> | 
        									<a href="control.php?action=woi&template_id='.$_GET['template_id'].'&userID='.$_GET['userID'].'&edit=form" class="textlink">edit category and subjects</a> 
        									</div>';
        								}
			        					print '<br />';
									}
									// games
									if (isset($_GET['game_id'])) {
										require "webofinquiry/woidb.php";
										$getGame= "SELECT template_id, teamID, game_start, game_name, game_description, game_public, game_complete FROM game WHERE game_id =?";
			        					$game = $mysqli->execute_query($getGame, [$_GET['game_id']])->fetch_assoc();
			        					print 'game ID - '; echo $_GET['game_id']; print '<br />';
			        					print 'name - '; echo stripslashes($game['game_name']); print '<br />';
			        					print 'description - '; echo stripslashes($game['game_description']); print '<br />';
			        					print 'started - '; echo $game['game_start']; print '<br />';
			        					print 'public (1=yes) - '; echo $game['game_public']; print '<br />';
			        					// template
			        					$getTemplate = "SELECT template_name FROM template WHERE template_id =?";
			        					$template = $mysqli->execute_query($getTemplate, [$game['template_id']])->fetch_assoc();
			        					print 'template - '; echo stripslashes($template['template_name']); print '<br />';
			        					// team
			        					require('accountsdb.php');
										$getTeam = "SELECT teamName FROM ttteam WHERE teamID =?";
			        					$team = $mysqli->execute_query($getTeam, [$game['teamID']])->fetch_assoc();
			        					print 'team (ID) - '; echo $team['teamName']; print ' ('; echo $game['teamID']; print ')<br />';
			        					// turns
			        					require "webofinquiry/woidb.php";
			        					$getTurns = "SELECT * FROM turn WHERE game_id=?";
										$turns = $mysqli->execute_query($getTurns, [$_GET['game_id']])->fetch_all(MYSQLI_ASSOC);
										$turnCount = count($turns);
			        					print 'turns taken - '; echo $turnCount; print '<br />';
			        					if ($turnCount > 0) print '(Check the status of the game and turns before deleting.) <br />';
			        					// delete check
			        					if ($_GET['delete'] == "check") {
			        						print '<div style="text-align:center">
			        						<br />Delete this game?<br />
        									<a href="control.php?action=woi&game_id='.$_GET['game_id'].'&userID='.$_GET['userID'].'&delete=yes" class="textlink">yes, delete</a> | 
        									<a href="control.php?action=woi&game_id='.$_GET['game_id'].'&userID='.$_GET['userID'].'" class="textlink">no, cancel</a> 
        									</div>';
			        					}
			        					// delete game and associated data
			        					elseif ($_GET['delete'] == "yes") {
			        						require "webofinquiry/woidb.php";
							  				// turns, text 
							  				$getTurns = "SELECT turn_id FROM turn WHERE game_id=?";
											$turns = $mysqli->execute_query($getTurns, [$_GET['game_id']])->fetch_all(MYSQLI_ASSOC);
											foreach ($turns as $turns_key => $turn) {
												$getTurnText = "SELECT turn_text_id FROM turn_text WHERE turn_id=?";
												$turnText = $mysqli->execute_query($getTurnText, [$turn['turn_id']])->fetch_assoc();
												$stmt = $mysqli->prepare("DELETE FROM turn_text WHERE turn_text_id=?");
								  				$stmt->bind_param("i", $turnText['turn_text_id']);
								  				$stmt->execute();
								  				$stmt->close();
												$stmt = $mysqli->prepare("DELETE FROM turn WHERE turn_id=?");
								  				$stmt->bind_param("i", $turn['turn_id']);
								  				$stmt->execute();
								  				$stmt->close();
											}
											//game
											$stmt = $mysqli->prepare("DELETE FROM game WHERE game_id=?");
							  				$stmt->bind_param("i", $_GET['game_id']);
							  				$stmt->execute();
							  				$stmt->close();
							  				print '<br />game deleted<br />';
			        					}
			        					// delete link
			        					else {
			        						print '<div style="text-align:center">
        									<a href="control.php?action=woi&game_id='.$_GET['game_id'].'&userID='.$_GET['userID'].'&delete=check" class="textlink">delete this game</a> 
        									</div>';
        								}
			        					print '<br />';
									}
									// templates
									require "webofinquiry/woidb.php";
									$getTemplates = "SELECT template_id, template_name FROM template WHERE template_creator =?";
			        				$templates = $mysqli->execute_query($getTemplates, [$_GET['userID']])->fetch_all(MYSQLI_ASSOC);
			        				if (count($templates) > 0) print '<strong>Templates</strong><br />';
			        				else print 'No game templates<br />';
									foreach ($templates as $templates_key => $template) {
										print '<a href="control.php?action=woi&userID='.$_GET['userID'].'&template_id='.$template['template_id'].'" class="textlink">'; echo stripslashes($template['template_name']); print '</a><br />';
									}
									print '<br />';
									// games 
									$getGames = "SELECT game_id, game_name FROM game WHERE game_creator =?";
			        				$games = $mysqli->execute_query($getGames, [$_GET['userID']])->fetch_all(MYSQLI_ASSOC);
			        				if (count($games) > 0) print '<strong>Games</strong><br />';
			        				else print 'No games<br />';
									foreach ($games as $games_key => $game) {
										print '<a href="control.php?action=woi&userID='.$_GET['userID'].'&game_id='.$game['game_id'].'" class="textlink">'; echo stripslashes($game['game_name']); print '</a><br />';
									}
									print '<br />';
								}
								// ================ teams by user =================
								if ($_GET['action'] == "teams" && isset($_GET['userID'])) {
									print 'Teams Information (user is admin)<br /><br />';
									//get username
									require('accountsdb.php');
									$getUser = "SELECT username FROM ttuser WHERE userID =?";
			        				$user = $mysqli->execute_query($getUser, [$_GET['userID']])->fetch_assoc();
									print 'Username <br />'; echo $user['username']; print '<br /><br />';
									// teams
									$getTeams = "SELECT teamID, teamName FROM ttteam WHERE userID =?";
			        				$teams = $mysqli->execute_query($getTeams, [$_GET['userID']])->fetch_all(MYSQLI_ASSOC);
									foreach ($teams as $teams_key => $team) {
										print '<a href="control.php?action=teams&userID='.$_GET['userID'].'&teamID='.$team['teamID'].'" class="textlink">'; echo stripslashes($team['teamName']); print '</a><br />';
									}
									print '<br />';
									if (isset($_GET['teamID'])) {
										$getTeam = "SELECT * FROM ttteam WHERE teamID =?";
			        					$team = $mysqli->execute_query($getTeam, [$_GET['teamID']])->fetch_assoc();
			        					print 'team ID - '; echo $team['teamID']; print '<br />';
			        					print 'name - '; echo $team['teamName']; print '<br />';
			        					print 'created - '; echo $team['teamCreated']; print '<br />';
			        					$getTeamMems = "SELECT userID FROM ttteam_mem WHERE teamID =?";
			        					$mems = $mysqli->execute_query($getTeamMems, [$_GET['teamID']])->fetch_all(MYSQLI_ASSOC);
			        					print 'members - '; echo count($mems); print '<br /><br />';
			        					// delete check
			        					if ($_GET['delete'] == "check") {
			        						print '<div style="text-align:center">';
			        						print 'Delete this team and the team members\' association with this team (will not delete any users, games, or sessions)<br />
			        						<a href="control.php?action=teams&userID='.$_GET['userID'].'&teamID='.$_GET['teamID'].'&delete=yes" class="textlink">Yes</a>';
			        						print '</div>';
			        					}
			        					// delete 
			        					elseif ($_GET['delete'] == "yes") {
		        							$stmt = $mysqli->prepare("DELETE FROM ttteam_mem WHERE teamID=?");
			  								$stmt->bind_param("i", $_GET['teamID']);
			  								$stmt->execute();
			  								$stmt->close();
											$stmt = $mysqli->prepare("DELETE FROM ttteam WHERE teamID=?");
			  								$stmt->bind_param("i", $_GET['teamID']);
			  								$stmt->execute();
			  								$stmt->close();
			  								print 'deleted team';
			        					}
			        					elseif (isset($_GET['teamID'])) {
			        						print '<div style="text-align:center">';
			        						print '<a href="control.php?action=teams&userID='.$_GET['userID'].'&teamID='.$_GET['teamID'].'&delete=check" class="textlink">delete team</a>';
			        						print '</div>';
			        					}
									}
								}
								// ================ orgs by user =================
								if ($_GET['action'] == "orgs" && isset($_GET['userID'])) {
									print 'Orgs Information (user is admin)<br /><br />';
									//get username
									require('accountsdb.php');
									$getUser = "SELECT username FROM ttuser WHERE userID =?";
			        				$user = $mysqli->execute_query($getUser, [$_GET['userID']])->fetch_assoc();
									print 'Username <br />'; echo $user['username']; print '<br /><br />';
									$getOrgs = "SELECT orgID, orgName FROM ttorg WHERE userID =?";
			        				$orgs = $mysqli->execute_query($getOrgs, [$_GET['userID']])->fetch_all(MYSQLI_ASSOC);
									foreach ($orgs as $orgs_key => $org) {
										print '<a href="control.php?action=orgs&userID='.$_GET['userID'].'&orgID='.$org['orgID'].'" class="textlink">'; echo stripslashes($org['orgName']); print '</a><br />';
									}
									print '<br />';
									if (isset($_GET['orgID'])) {
										$getOrg = "SELECT * FROM ttorg WHERE orgID =?";
			        					$org = $mysqli->execute_query($getOrg, [$_GET['orgID']])->fetch_assoc();
			        					print 'org ID - '; echo $org['orgID']; print '<br />';
			        					print 'name - '; echo $org['orgName']; print '<br />';
			        					print 'created - '; echo $org['orgCreated']; print '<br />';
			        					$getOrgMems = "SELECT userID FROM ttorg_mem WHERE orgID =?";
			        					$mems = $mysqli->execute_query($getOrgMems, [$_GET['orgID']])->fetch_all(MYSQLI_ASSOC);
			        					print 'members - '; echo count($mems); print '<br />';
			        					$getOrgTeams = "SELECT teamID FROM ttteam WHERE orgID =?";
			        					$teams = $mysqli->execute_query($getOrgTeams, [$_GET['orgID']])->fetch_all(MYSQLI_ASSOC);
			        					print 'teams - '; echo count($teams); print '<br /><br />';
			        					// delete check
			        					if ($_GET['delete'] == "check") {
			        						print '<div style="text-align:center">';
			        						print 'Delete this org and the teams\' and team members\' association with this org (will not delete any teams, users, games, or sessions)<br />
			        						<a href="control.php?action=orgs&userID='.$_GET['userID'].'&orgID='.$_GET['orgID'].'&delete=yes" class="textlink">Yes</a>';
			        						print '</div>';
			        					}
			        					// delete 
			        					elseif ($_GET['delete'] == "yes") {
		        							$stmt = $mysqli->prepare("DELETE FROM ttorg_mem WHERE orgID=?");
			  								$stmt->bind_param("i", $_GET['orgID']);
			  								$stmt->execute();
			  								$stmt->close();
			  								$stmt = $mysqli->prepare("UPDATE ttteam SET orgID=0 WHERE orgID=?");
											$stmt->bind_param('i', $_GET['orgID']);
											$stmt->execute();
											$stmt->close();
											$stmt = $mysqli->prepare("DELETE FROM ttorg WHERE orgID=?");
			  								$stmt->bind_param("i", $_GET['orgID']);
			  								$stmt->execute();
			  								$stmt->close();
			  								print 'deleted org';
			        					}
			        					elseif (isset($_GET['orgID'])) {
			        						print '<div style="text-align:center">';
			        						print '<a href="control.php?action=orgs&userID='.$_GET['userID'].'&orgID='.$_GET['orgID'].'&delete=check" class="textlink">delete org</a>';
			        						print '</div>';
			        					}
									}
								}
								
								// ================ user account =============
								// user update
								if ($_GET['action'] == "userupdate") {
									print 'User Information<br /><br />';
									require('accountsdb.php');
									$stmt = $mysqli->prepare("UPDATE ttuser SET fontcolor=?, active=?, teacher=?, student=? WHERE userID=?");
									$stmt->bind_param('siiii', $_POST['fontcolor'], $_POST['active'], $_POST['teacher'], $_POST['student'], $_POST['userID']);
									$stmt->execute();
									$stmt->close();
									print 'account profile updated<br />';
								}
								// user edit
								if ($_GET['action'] == "useredit") {
									print 'User Information noneditable by user<br /><br />';
									require('accountsdb.php');
									$getUser = "SELECT username, fontcolor, active, teacher, student FROM ttuser WHERE userID=?";
	        						$user = $mysqli->execute_query($getUser, [$_GET['userID']])->fetch_assoc();
	        						print 'username - '; echo $user['username']; print'<br /><br />';
	        						print '<form action="control.php?action=userupdate" method="post"> 
									<div class="fielddiv">
										<div class="fieldname">
											Fontcolor
										</div>
										<div class="fieldvalue">
											<input name="fontcolor" type="text" class="inputtext" placeholder="font color e.g. #a1b2c3" value="'.$user['fontcolor'].'" />
										</div>
									</div>
									<div class="fielddiv">
										<div class="fieldname">
											Active
										</div>
										<div class="fieldvalue">';
											if ($user['active'] ==1) { 
												print '<input name="active" type="radio" value="1" checked /> yes
												<input name="active" type="radio" value="0" /> no';
											}
											else {
												print '<input name="active" type="radio" value="1" /> yes
												<input name="active" type="radio" value="0" checked /> no';
											}
										print '</div>
									</div>
									<br />
									<div class="fielddiv">
										<div class="fieldname">
											Teacher
										</div>
										<div class="fieldvalue">';
											if ($user['teacher'] ==1) { 
												print '<input name="teacher" type="radio" value="1" checked /> yes
												<input name="teacher" type="radio" value="0" /> no';
											}
											else {
												print '<input name="teacher" type="radio" value="1" /> yes
												<input name="teacher" type="radio" value="0" checked /> no';
											}
										print '</div>
									</div>
									<br />
									<div class="fielddiv">
										<div class="fieldname">
											Student
										</div>
										<div class="fieldvalue">';
											if ($user['student'] ==1) { 
												print '<input name="student" type="radio" value="1" checked /> yes
												<input name="student" type="radio" value="0" /> no';
											}
											else {
												print '<input name="student" type="radio" value="1" /> yes
												<input name="student" type="radio" value="0" checked /> no';
											}
										print '</div>
									</div>
									<br />
									<input type="hidden" name="userID" value="'.$_GET['userID'].'" />
									<div class="fielddiv">
										<div class="fieldname">
										
										</div>
										<div class="fieldvalue">
											<input type="submit" name="submit" class="submitbutton" value="Submit" />
										</div>
									</div>
							      	</form>';
								}
								// user delete or inactive
								if ($_GET['action'] == "userdelete") {
									print 'User Information<br /><br />';
									require('accountsdb.php');
									if ($_GET['option'] == "delete") {
										// delete - check orgs, teams, messages, woi, qx
										$stmt = $mysqli->prepare("DELETE FROM ttuser WHERE userID=?");
						  				$stmt->bind_param("i", $_GET['userID']);
						  				$stmt->execute();
						  				$stmt->close();
						  				print 'user account deleted';
									}
									elseif ($_GET['option'] == "inactive") {
										// inactive
										$stmt = $mysqli->prepare("UPDATE ttuser SET active=0 WHERE userID=?");
										$stmt->bind_param('i', $_GET['userID']);
										$stmt->execute();
										$stmt->close();
										print 'user account set to inactive';
									}
									else {
										$getUser = "SELECT username FROM ttuser WHERE userID=?";
	        							$user = $mysqli->execute_query($getUser, [$_GET['userID']])->fetch_assoc();
	        							print 'username - '; echo $user['username']; print '<br /><br />';
	        							print '<div style="text-align:center">';
	        							if ($_GET['userID'] == 5 || $_GET['userID'] == 108) {
	        								print 'admin, no action allowed';
	        							}
	        							else {
		        							print 'review user\'s orgs, teams, messages, WoI, Quipx before deleting <br />'; 
		        							print '<a href="control.php?action=userdelete&userID='.$_GET['userID'].'&option=delete" class="textlink">delete forever</a> | ';
		        							print '<a href="control.php?action=userdelete&userID='.$_GET['userID'].'&option=inactive" class="textlink">make inactive</a> | ';
		        							print '<a href="control.php?" class="textlink">cancel</a><br /><br />';
	        							}
	        							print '</div>';
	        						}
								}
								// user search
								if ($_GET['action'] == "usersearch") {
									print 'User Information<br /><br />';
									print 'First name - '; echo $_POST['firstname']; print '<br />';
									print 'Last name - '; echo $_POST['lastname']; print '<br />';
									print 'Email - '; echo $_POST['email']; print '<br />';
									print 'Username - '; echo $_POST['username']; print '<br />';
									print '<br />';
									// find user(s)
									require('accountsdb.php');
									$usercount = 0;
									// check by username
									if ($_POST['username'] != "") {
										$getUser = "SELECT * FROM ttuser WHERE username=?";
        								$user = $mysqli->execute_query($getUser, [$_POST['username']])->fetch_assoc(); 
        								if (!empty($user)) {
        									$usercount = 1;
        									$userID = $user['userID'];
        									$firstname = $user['firstname'];
        									$lastname = $user['lastname'];
        									$email = $user['email'];
        									$username = $user['username'];
        									$startdate = $user['startdate'];
        									$fontcolor = $user['fontcolor'];
        									$active = $user['active'];
        									$teacher = $user['teacher'];
        									$student = $user['student'];
        								}
        							}
        							// check by email
        							if ($usercount == 0 && $_POST['email'] != "") {
        								$getUser = "SELECT * FROM ttuser WHERE email=?";
        								$user = $mysqli->execute_query($getUser, [$_POST['email']])->fetch_assoc(); 
        								if (!empty($user)) {
        									$usercount = 1;
        									$userID = $user['userID'];
        									$firstname = $user['firstname'];
        									$lastname = $user['lastname'];
        									$email = $user['email'];
        									$username = $user['username'];
        									$startdate = $user['startdate'];
        									$fontcolor = $user['fontcolor'];
        									$active = $user['active'];
        									$teacher = $user['teacher'];
        									$student = $user['student']; 
        								}
        							}
        							// 1 match 
        							if ($usercount == 1) {
        								// account info and actions
        								print 'userID - '; echo $userID; print '<br />';
        								print 'firstname - '; echo $firstname; print '<br />';
        								print 'lastname - '; echo $lastname; print '<br />';
        								print 'email - '; echo $email; print '<br />';
        								print 'username - '; echo $username; print '<br />';
        								print 'startdate - '; echo $startdate; print '<br />';
        								print 'fontcolor - '; echo $fontcolor; print '<br />';
        								print 'active (1=yes) - '; echo $active; print '<br />';
        								print 'teacher (1=yes) - '; echo $teacher; print '<br />';
        								print 'student (1=yes) - '; echo $student; print '<br />';
        								print '<div style="text-align:center">
        								<a href="control.php?action=userdelete&userID='.$userID.'" class="textlink">delete</a> | 
        								<a href="control.php?action=useredit&userID='.$userID.'" class="textlink">edit</a> | 
        								<a href="control.php?action=useremail&userID='.$userID.'" class="textlink">email</a>
        								</div>';
        								print '<br />';
        								// messages
        								print 'Messages sent - ';
        								$getMessages = "SELECT messageID FROM message WHERE senderID=?";
										$messages = $mysqli->execute_query($getMessages, [$userID])->fetch_all(MYSQLI_ASSOC);
										echo count($messages); print '<br />';
        								if (count($messages) > 0) {
        									print '<div style="text-align:center">
	        								<a href="control.php?action=messages&userID='.$userID.'" class="textlink">messages</a>
	        								</div>';
        								}
        								print '<br />';
										// orgs and teams
										$getOrgAdmin = "SELECT orgID FROM ttorg WHERE userID =?";
			        					$orgAdmin = $mysqli->execute_query($getOrgAdmin, [$userID])->fetch_all(MYSQLI_ASSOC);
			        					print 'Organizations (admin) - '; echo count($orgAdmin); print '<br />';
			        					$getOrgMem = "SELECT orgID FROM ttorg_mem WHERE userID =?";
			        					$orgMem = $mysqli->execute_query($getOrgMem, [$userID])->fetch_all(MYSQLI_ASSOC);
			        					print 'Organizations (member) - '; echo count($orgMem); print '<br />';
			        					$getTeamAdmin = "SELECT teamID FROM ttteam WHERE userID =?";
			        					$teamAdmin = $mysqli->execute_query($getTeamAdmin, [$userID])->fetch_all(MYSQLI_ASSOC);
			        					print 'Teams (admin) - '; echo count($teamAdmin); print '<br />';
			        					$getTeamMem = "SELECT teamID FROM ttteam_mem WHERE userID =?";
			        					$teamMem = $mysqli->execute_query($getTeamMem, [$userID])->fetch_all(MYSQLI_ASSOC);
			        					print 'Teams (member) - '; echo count($teamMem); print '<br />';
			        					print '<div style="text-align:center">
        								<a href="control.php?action=orgs&userID='.$userID.'" class="textlink">orgs</a> | 
        								<a href="control.php?action=teams&userID='.$userID.'" class="textlink">teams</a>
        								</div>';
        								print '<br />';
			        					// WoI games, Quipx sessions as team member
			        					$teamGames = 0;
			        					$teamSessions = 0;
			        					if (count($teamMem) > 0) {
				        					require('webofinquiry/woidb.php');
				        					foreach ($teamMem as $team_key => $team) {
				        						$getGames = "SELECT game_id FROM game WHERE teamID=?";
												$games = $mysqli->execute_query($getGames, [$team['teamID']])->fetch_all(MYSQLI_ASSOC);
												$teamGames = $teamGames + count($games);
				        					}
				        					require('quipx/qxdb.php');
				        					foreach ($teamMem as $team_key => $team) {
				        						$getSessions = "SELECT sessionID FROM session WHERE teamID=?";
												$sessions = $mysqli->execute_query($getSessions, [$team['teamID']])->fetch_all(MYSQLI_ASSOC);
												$teamSessions = $teamSessions + count($sessions);
				        					}
				        				}	
			        					// WoI games, Quipx sessions
			        					print 'Web of Inquiry games (team) - '; echo $teamGames; print '<br />'; 
			        					require('webofinquiry/woidb.php');
			        					$getGames = "SELECT game_id FROM game WHERE game_creator=?";
										$games = $mysqli->execute_query($getGames, [$userID])->fetch_all(MYSQLI_ASSOC);
										print 'Web of Inquiry games (admin) - '; echo count($games); print '<br />';
			        					$getTemplates = "SELECT template_id FROM template WHERE template_creator=?";
										$templates = $mysqli->execute_query($getTemplates, [$userID])->fetch_all(MYSQLI_ASSOC);
										print 'Web of Inquiry game templates (admin) - '; echo count($templates); print '<br />';
										print 'Quipx sessions (team) - '; echo $teamSessions; print '<br />'; 
										require('quipx/qxdb.php');
										$getSessions = "SELECT sessionID FROM session WHERE userID=?";
										$sessions = $mysqli->execute_query($getSessions, [$userID])->fetch_all(MYSQLI_ASSOC);
										print 'Quipx sessions (admin) - '; echo count($sessions); print '<br />';
										print '<div style="text-align:center">
        								<a href="control.php?action=woi&userID='.$userID.'" class="textlink">Web of Inquiry</a> | 
        								<a href="control.php?action=quipx&userID='.$userID.'" class="textlink">Quipx</a>
        								</div>';
        								print '<br />';
        							}
        							// check by firstname and lastname
        							if ($usercount == 0 && $_POST['firstname'] != "" && $_POST['lastname'] != "") {
        								$getUser = "SELECT userID, firstname, lastname, email, username, startdate, fontcolor, active FROM ttuser WHERE firstname=? AND lastname=?";
        								$users = $mysqli->execute_query($getUser, [$_POST['firstname'], $_POST['lastname']])->fetch_all(MYSQLI_ASSOC); 
        								if (count($users) > 0) {
	        								foreach ($users as $user_key => $user) {
	        									$usercount = 1;
	        									$userID = $user['userID'];
	        									$firstname = $user['firstname'];
	        									$lastname = $user['lastname'];
	        									$email = $user['email'];
	        									$username = $user['username'];
	        									$startdate = $user['startdate'];
	        									$fontcolor = $user['fontcolor'];
	        									$active = $user['active'];
	        									print 'userID - '; echo $userID; print '<br />';
	        									print 'firstname - '; echo $firstname; print '<br />';
		        								print 'lastname - '; echo $lastname; print '<br />';
		        								print 'email - '; echo $email; print '<br />';
		        								print 'username - '; echo $username; print '<br />';
		        								print 'startdate - '; echo $startdate; print '<br />';
		        								print 'fontcolor - '; echo $fontcolor; print '<br />';
		        								print 'active (1=yes) - '; echo $active; print '<br />';
	        								}
	        							}
        							}
        							// no match
        							if ($usercount == 0) { 
        								print 'no match <br />';
        							}
								}
								// user form
								if ($_GET['action'] == "userform") {
									print 'User Information<br /><br />
									<form action="control.php?action=usersearch" method="post"> 
									<div class="fielddiv">
										<div class="fieldname">
											First name
										</div>
										<div class="fieldvalue">
											<input name="firstname" type="text" class="inputtext" placeholder="first name" />
										</div>
									</div>
									<div class="fielddiv">
										<div class="fieldname">
											Last name
										</div>
										<div class="fieldvalue">
											<input name="lastname" type="text" class="inputtext" placeholder="last name" />
											<br />
											enter first and last names to search by name only
										</div>
									</div>
									<div class="fielddiv">
										<div class="fieldname">
											Email
										</div>
										<div class="fieldvalue">
											<input name="email" type="text" class="inputtext" placeholder="email" />
										</div>
									</div>
									<div class="fielddiv">
										<div class="fieldname">
											Username
										</div>
										<div class="fieldvalue">
											<input name="username" type="text" class="inputtext" placeholder="username" />
										</div>
									</div>
									<div class="fielddiv"">
										<div class="fieldname">
										
										</div>
										<div class="fieldvalue">
											<input type="submit" name="submit" class="submitbutton" value="Submit" />
										</div>
									</div>
							      	</form>
									';
								}
								// user email
								if ($_GET['action'] == "useremail") {
									print 'Email to user<br /><br />';
									//get username
									require('accountsdb.php');
									$getUser = "SELECT username FROM ttuser WHERE userID =?";
			        				$user = $mysqli->execute_query($getUser, [$_GET['userID']])->fetch_assoc();
									print 'Username <br />'; echo $user['username']; print '<br /><br />';
									if ($_GET['send'] == "yes") {
										$getUser = "SELECT email FROM ttuser WHERE userID=?";
        								$user = $mysqli->execute_query($getUser, [$_GET['userID']])->fetch_assoc();
										$to = "".$user['email']."";
										$subject = "".$_POST['subject']."";
										$logo = '<br /><br /><br /><img src="https://thinkertools.org/prototype/version3/images/TTsigBG.jpg" alt="Thinkertools Logo" />';
										$message = "".$_POST['message']." ".$logo."";
										$from = "admin@thinkertools.org";
										$headers = "MIME-Version: 1.0" . "\r\n";
										$headers .= "Content-type:text/html;charset=iso-8859-1" . "\r\n";
										$headers .= "From:" . $from . "\r\n";
										mail($to,$subject,$message,$headers);
										// account ready message
										print 'Email sent<br />';
									}
									else {
										print '
										<form action="control.php?action=useremail&userID='.$_GET['userID'].'&send=yes" method="post"> 
										<div class="fielddiv">
											<div class="fieldname">
												Subject
											</div>
											<div class="fieldvalue">
												<input name="subject" type="text" class="inputtext" required />
											</div>
										</div>
										<div class="fielddiv">
											<div class="fieldname">
												Message
											</div>
											<div class="fieldvalue">
												<textarea name="message" style="width:410px; height:120px" required></textarea>
											</div>
										</div>
										<div class="fielddiv"">
											<div class="fieldname">
											
											</div>
											<div class="fieldvalue">
												<input type="submit" name="submit" class="submitbutton" value="Send" />
											</div>
										</div>
								      	</form>
										';
									}
								}
							print '</div>
						</div>
						';
					}
				}
				else {
					session_unset();
					print '
					<div class="column">
						<div class="toolbox login">
							Access denied
						</div>
					</div>';
				}
			?>
		</div>
	</body>
</html>
