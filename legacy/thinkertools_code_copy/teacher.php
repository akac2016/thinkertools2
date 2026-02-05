<?php session_start();
	// user account db
	require('accountsdb.php');
	// lesson plan insert or update
	if ($_GET['action'] == 'insert') {
		$stmt = $mysqli->prepare("INSERT INTO lessonplan (userID, share, platform, duration, subject, plan) VALUES (?,?,?,?,?,?)");
  		$stmt->bind_param("iissss", $_SESSION['userID'], $_POST['share'], $_POST['platform'], $_POST['duration'], $_POST['subject'], $_POST['plan']);
  		$stmt->execute();
  		$stmt->close();
  	}
  	if ($_GET['action'] == 'update') {
		$stmt = $mysqli->prepare("UPDATE lessonplan SET share=?, platform=?, duration=?, subject=?, plan=? WHERE lessonID=?");
  		$stmt->bind_param("isissi", $_POST['share'], $_POST['platform'], $_POST['duration'], $_POST['subject'], $_POST['plan'], $_GET['lessonID']);
  		$stmt->execute();
  		$stmt->close();
  		sleep(1);
  	}
  	// teacher check
  	$teachercheck = 0;
  	$getUser = "SELECT teacher FROM ttuser WHERE userID=?";
	$user = $mysqli->execute_query($getUser, [$_SESSION['userID']])->fetch_assoc();
	if ($user['teacher']==1) $teachercheck = 1; 
?>
<!DOCTYPE html>
<html lang="en">
	<head>
		<meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
		<title>Thinkertools teacher</title>
		<link rel="stylesheet" href="main.css" content="text/html; charset=utf-8"/>
		<!-- main head and dropdown menu -->
		<meta name="viewport" content="width=device-width, initial-scale=1">
		<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
		<link rel="stylesheet" href="mainhead.css" content="text/html; charset=utf-8"/>
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
			// left column	
			print '<div class="column">';
				// check for teacher login
				if (!isset($_SESSION['userID']) || $teachercheck == 0) {
					print '<div class="contentbox">Create or log in to your teacher account to get started<br /></div>';
				}
				// classes available
				else {
					print '<div class="toolbox" style="background-color: #C63232; color: white;">Your Classes</div>';
					print '<div class="contentbox" style="margin-top:0px; border-top:none">';
						$getOrgs = "SELECT orgID FROM ttorg WHERE userID =?";
    					$orgs = $mysqli->execute_query($getOrgs, [$_SESSION['userID']])->fetch_all(MYSQLI_ASSOC);
    					if (count($orgs)>0) {
							print 'Click a class name to view teams, students, and messages<br /><br />';
							foreach ($orgs as $org) {
								$getOrgName = "SELECT orgName FROM ttorg WHERE orgID = ?";
								$orgName = $mysqli->execute_query($getOrgName, [$org['orgID']])->fetch_assoc();	
								print '<a href="teacher.php?action=view&orgID='.$org['orgID'].'" class="textlink">'; echo stripslashes($orgName['orgName']); print '</a><br />';
					    	}
					    }
					    else print '<br />You have no Classes set up';
					print '</div>';
					// update 
					if ($_GET['action'] == 'update') {
						print '<div class="contentbox">';
							$teammemID = $_POST['teammemID'];
							$teamnum = $_POST['teamnum'];
							foreach($teammemID as $key => $n) {
								$stmt = $mysqli->prepare("UPDATE ttteam_mem SET teamID=? WHERE teammemID=?");
								$stmt->bind_param('ii', $teamnum[$key], $n);
								$stmt->execute();
								$stmt->close();
							}
							// new team
							if ($_POST['teamName'] != "") {
								$teamName = $_POST['teamName'];
								$teamCreated = date('Y-m-d H:i:s');
								$stmt = $mysqli->prepare("INSERT INTO ttteam (orgID, teamName, teamCreated, userID) VALUES (?,?,?,?)");
							  	$stmt->bind_param("issi", $_POST['orgID'], $teamName, $teamCreated, $_SESSION['userID']);
							  	$stmt->execute();
							  	$stmt->close();
							  	sleep(1);
							  	// get new teamID
							  	$getNewTeam = "SELECT teamID FROM ttteam WHERE userID=? AND teamCreated=?";
							  	$newTeam = $mysqli->execute_query($getNewTeam, [$_SESSION['userID'], $teamCreated])->fetch_assoc();
							  	$teamID = $newTeam['teamID'];
							  	// insert teacher into new team
							  	$stmt = $mysqli->prepare("INSERT INTO ttteam_mem (teamID, userID) VALUES (?,?)");
								$stmt->bind_param("ii", $teamID, $_SESSION['userID']);
								$stmt->execute();
								$stmt->close();
							}
							// new student
							if ($_POST['firstname'] != "" && $_POST['lastname'] != "") {
								$teamID = $_POST['teamID'];
								$orgID = $_POST['orgID'];
								$email = "admin@thinkertools.org";
								$student = 1;
								$first = preg_replace("/[^a-zA-Z]/", '', $_POST['firstname']); 
							 	$last = preg_replace("/[^a-zA-Z]/", '', $_POST['lastname']);
								$startdate = date('Y-m-d H:i:s');
						 		$red = rand(0,255);
								$green = rand(0,255);
								$blue = rand(0,255);
								$fontcolor = sprintf("#%02x%02x%02x", $red, $green , $blue);
								$hex = ltrim($fontcolor, '#'); 
								$username = $first . $last . $red;
								$password = $last . $fontcolor;
								// insert into ttuser, get userID
						 		$stmt = $mysqli->prepare("INSERT INTO ttuser (username, firstname, lastname, email, password, startdate, fontcolor, student) VALUES (?,?,?,?,?,?,?,?)");
								$stmt->bind_param("sssssssi", $username, $first, $last, $email, $password, $startdate, $fontcolor, $student);
								$stmt->execute();
								$stmt->close();
								sleep(1);
								// get student userID
								$getStudent = "SELECT userID FROM ttuser WHERE username =? and fontcolor =?";
	        					$student = $mysqli->execute_query($getStudent, [$username, $fontcolor])->fetch_assoc();
	        					$studentID = $student['userID'];
	        					// add student to org_mem
	        					$stmt = $mysqli->prepare("INSERT INTO ttorg_mem (orgID, userID) VALUES (?,?)");
				  				$stmt->bind_param("ii", $orgID, $studentID);
				  				$stmt->execute();
				  				$stmt->close();
				  				// add student to team_mem
				  				$stmt = $mysqli->prepare("INSERT INTO ttteam_mem (teamID, userID) VALUES (?,?)");
								$stmt->bind_param("ii", $teamID, $studentID);
								$stmt->execute();
								$stmt->close();
								// email new user
								$to = "admin@thinkertools.org";
								$subject = "A student account has been created";
								$activatelink = "https://thinkertools.us/profile.php?code1=".$studentID."&code2=".$hex."";
								$message = "A student account is ready, but you need to activate it. Please click this link to <a href=".$activatelink.">activate account</a>. <br /><br />";
								$from = "admin@thinkertools.org";
								$headers = "MIME-Version: 1.0" . "\r\n";
								$headers .= "Content-type:text/html;charset=iso-8859-1" . "\r\n";
								$headers .= "From:" . $from . "\r\n";
								mail($to,$subject,$message,$headers);
							}
							// complete message
							print 'The teams were updated.';
						print '</div>';
					}
					// manage
					if ($_GET['action'] == 'manage') {
						print '<div class="contentbox">';
						//check if admin
						$getOrg  = "SELECT orgName FROM ttorg WHERE orgID=? AND userID=?";
					  	$org = $mysqli->execute_query($getOrg, [$_GET['orgID'], $_SESSION['userID']])->fetch_assoc();
					  	if (isset($org['orgName'])) {
					 		print '<strong>'; echo $org['orgName']; print '</strong>';
					 		$getTeams = "SELECT teamID, teamName FROM ttteam WHERE orgID=?";
							$teams = $mysqli->execute_query($getTeams, [$_GET['orgID']])->fetch_all(MYSQLI_ASSOC);
							if (count($teams) > 0) {
								print '<form action="teacher.php?action=update" method="post" class="form" style="margin-top: 12px" onsubmit="disableButton()">';
								foreach ($teams as $key => $team) {
									$getStudentIDs = "SELECT teammemID, userID FROM ttteam_mem WHERE teamID=? AND userID !=?";
		        					$studentIDs = $mysqli->execute_query($getStudentIDs, [$team['teamID'], $_SESSION['userID']])->fetch_all(MYSQLI_ASSOC);
		        					if (count($studentIDs) > 0) {
		        						foreach ($studentIDs as $key => $studentID) {
		        							print '<div style="width:100%; height:18px; display: inline-block;">';
		        							$getStudent = "SELECT * FROM ttuser WHERE userID=?";
		        							$student = $mysqli->execute_query($getStudent, [$studentID['userID']])->fetch_assoc();
		        								print '<div style="float:left; width: 50%;">';
		        									echo $student['firstname']; print ' '; echo $student['lastname']; 
		        								print '</div>'; 
		        								print '<div style="float:left; width: 50%;">';
		        									// echo $team['teamName'];  echo $team['teamID'];
		        									print '<select name = "teamnum[]" class="select">
														<option value = "'.$team['teamID'].'">'.$team['teamName'].'</option>';
														// get other teams
														$getOtherTeams = "SELECT teamID, teamName FROM ttteam WHERE orgID=? AND teamID !=?";
														$otherTeams = $mysqli->execute_query($getOtherTeams, [$_GET['orgID'], $team['teamID']])->fetch_all(MYSQLI_ASSOC);
														if (count($otherTeams) > 0) {
															foreach ($otherTeams as $key => $otherTeam) {
																print '<option value = "'.$otherTeam['teamID'].'">'.$otherTeam['teamName'].'</option>';
															}
														}
													print '</select>';
		        								print '</div>';
		        							print '</div>';
		        							print '<input type="hidden" name="teammemID[]" value="'.$studentID['teammemID'].'" />';
		        						}
		        					}
		        				}
		        				// add student if < 32 in org
		        				$getStudentCount = "SELECT orgmemID FROM ttorg_mem WHERE orgID=?";
	        					$studentCount = $mysqli->execute_query($getStudentCount, [$_GET['orgID']])->fetch_all(MYSQLI_ASSOC);
	        					if (count($studentCount) < 32) {
	        						print '<br /><br />Add a student? (Will take up to 24 hours to activate.)<br />
        							<input name="firstname" type="text" class="inputtext" style="width:150px; margin-right:8px;" placeholder="first" />
				  					<input name="lastname" type="text" class="inputtext" style="width:150px; margin-right:8px;" placeholder="last" />
				  					<select name = "teamID" class="select">';
					  					$getAllTeams = "SELECT teamID, teamName FROM ttteam WHERE orgID=?";
										$allTeams = $mysqli->execute_query($getAllTeams, [$_GET['orgID']])->fetch_all(MYSQLI_ASSOC);
										if (count($allTeams) > 0) {
											foreach ($allTeams as $key => $allTeam) {
												print '<option value = "'.$allTeam['teamID'].'">'.$allTeam['teamName'].'</option>';
											}
										}
									print '</select>';
	        					}
	        					// add team if < 8
		        				if (count($teams) < 8) {
		        					print '<br /><br />Add a team?<br />
		        					<div class="fielddiv">
										<div class="fieldvalue">
											<input name="teamName" type="text" class="inputtext" maxlength="50" placeholder="team name, max 50 letters and numbers" />
										</div>
									</div>';
		        				}
		        				print '<input type="hidden" name="orgID" value="'.$_GET['orgID'].'" />
		        				<input type="submit" name="submit" class="submitbutton" style="margin-top:12px;" value="Submit" id="btn" />';
		        				print '</form>';
	        				}
					 	}
					 	else print 'not authorized';
					  	print '</div>';
					}
					// view
					if ($_GET['action'] == 'view') {
						//check if admin
						$getOrg  = "SELECT orgName FROM ttorg WHERE orgID=? AND userID=?";
					  	$org = $mysqli->execute_query($getOrg, [$_GET['orgID'], $_SESSION['userID']])->fetch_assoc();
					  	if (isset($org['orgName'])) { 
							// org and team info
						  	print '<div class="contentbox">';
							  	print '<strong>'; echo $org['orgName']; print '</strong> 
							  	<a href="teacher.php?action=manage&orgID='.$_GET['orgID'].'" class="textlink">manage teams</a><br />';
							  	print 'First Last name (username password)<br /><br />';
							  	$getTeams = "SELECT teamID, teamName FROM ttteam WHERE orgID=?";
								$teams = $mysqli->execute_query($getTeams, [$_GET['orgID']])->fetch_all(MYSQLI_ASSOC);
								if (count($teams) > 0) {
									foreach ($teams as $key => $team) {
										print '<strong>'; echo $team['teamName']; print '</strong><br />';
										$getStudentIDs = "SELECT userID FROM ttteam_mem WHERE teamID=? AND userID !=?";
			        					$studentIDs = $mysqli->execute_query($getStudentIDs, [$team['teamID'], $_SESSION['userID']])->fetch_all(MYSQLI_ASSOC);
			        					if (count($studentIDs) > 0) {
			        						foreach ($studentIDs as $key => $studentID) {
			        							$getStudent = "SELECT * FROM ttuser WHERE userID=?";
			        							$student = $mysqli->execute_query($getStudent, [$studentID['userID']])->fetch_assoc();
			        							echo $student['firstname']; print ' '; echo $student['lastname']; print ' ('; 
			        							echo $student['username']; print ' '; echo $student['password'];  print ' )'; 
			        							print '<br />';
			        						}
			        					}
			        					print '<br />';
									}
								}
							print '</div>';
							// messages
							print '<div class="contentbox">';
								print '<strong>Messages</strong><br />
								<a href="teacher.php?orgID='.$_GET['orgID'].'&action=view&message=view" class="textlink">view</a> | <a href="teacher.php?orgID='.$_GET['orgID'].'&action=view&message=send" class="textlink">send</a>';
								if ($_GET['message'] == 'view') {
									print '<br /><br />';
									// insert new message
									if ($_GET['send'] == 'yes') {
										$recInd = 0;
										$recAll = 0;
										$game_id = 0;
										$sessionID = 0;
										$sentTime = date('Y-m-d H:i:s');
										// senderName
										$getName = "SELECT firstname, lastname FROM ttuser WHERE userID =?";
							        	$name = $mysqli->execute_query($getName, [$_SESSION['userID']])->fetch_assoc();
										$senderName = stripslashes($name['firstname']) . " " . stripslashes($name['lastname']);
										if ($_POST['recOrg'] > 0) {
											$recOrg = $_POST['recOrg'];
											$recTeam = 0;
											// insert message
											$stmt = $mysqli->prepare("INSERT INTO message (subject, message, sentTime, senderID, senderName, recInd, recTeam, recOrg, recAll, game_id, sessionID) VALUES (?,?,?,?,?,?,?,?,?,?,?)");
										  	$stmt->bind_param("sssisiiiiii", $_POST['subject'], $_POST['message'], $sentTime, $_SESSION['userID'], $senderName, $recInd, $recTeam, $recOrg, $recAll, $game_id, $sessionID);
										  	$stmt->execute();
										  	$stmt->close();
										  	print 'Message sent <br /><br />';
										}
										else {
											if (isset($_POST['recTeam'])) {
												$recOrg = 0;
												$recTeam = $_POST['recTeam'];
												// insert message
												$stmt = $mysqli->prepare("INSERT INTO message (subject, message, sentTime, senderID, senderName, recInd, recTeam, recOrg, recAll, game_id, sessionID) VALUES (?,?,?,?,?,?,?,?,?,?,?)");
											  	$stmt->bind_param("sssisiiiiii", $_POST['subject'], $_POST['message'], $sentTime, $_SESSION['userID'], $senderName, $recInd, $recTeam, $recOrg, $recAll, $game_id, $sessionID);
											  	$stmt->execute();
											  	$stmt->close();
											  	print 'Message sent <br /><br />';
											}
											else print 'You\'ll need to go back to select the class or a team<br /><br />';
										}
									}
									// classes
									$messageArray= array();
									$getOrgs = "SELECT orgID FROM ttorg_mem WHERE userID =?";
		        					$orgs = $mysqli->execute_query($getOrgs, [$_SESSION['userID']])->fetch_all(MYSQLI_ASSOC);
									foreach($orgs as $org) {
										foreach($org as $org_key => $orgID) {
											$getMessages = "SELECT messageID FROM message WHERE recOrg=? ORDER BY messageID DESC";
											$messages = $mysqli->execute_query($getMessages, [$orgID])->fetch_all(MYSQLI_ASSOC);
											if (!empty($messages)) {
												foreach($messages as $message_key => $message) {
													array_push($messageArray, $message);
												}
											}
										}
										// teams by class
										$getTeams = "SELECT teamID FROM ttteam WHERE orgID=?";
										$teams = $mysqli->execute_query($getTeams, [$orgID])->fetch_all(MYSQLI_ASSOC);
										if (count($teams) > 0) {
											foreach($teams as $team_key => $team) {
												$getMessages = "SELECT messageID FROM message WHERE recTeam=? ORDER BY messageID DESC";
												$messages = $mysqli->execute_query($getMessages, [$team['teamID']])->fetch_all(MYSQLI_ASSOC);
												if (!empty($messages)) {
													foreach($messages as $message_key => $message) {
														array_push($messageArray, $message);
													}
												}	
											}
										}
									}
									rsort($messageArray);
									foreach($messageArray as $message) {
										foreach($message as $message_key => $messageID) {
											// echo $messageID; print '<br />';
											$getMessage = "SELECT * FROM message WHERE messageID=?";
											$message = $mysqli->execute_query($getMessage, [$messageID])->fetch_all(MYSQLI_ASSOC);
											foreach($message as $message_key => $content) {
												print 'Subject: <strong>'; echo stripslashes($content['subject']); print '</strong><br />';
												print 'Sender: '; echo stripslashes($content['senderName']); print '<br />';
												print 'Sent: '; echo $content['sentTime']; print ' ET<br />';
												print 'Message: '; echo stripslashes($content['message']); 
												print '<br /><br />';
											}
										}
									}
									
								}
								if ($_GET['message'] == 'send') {
									print '<form action="teacher.php?action=view&message=view&send=yes&orgID='.$_GET['orgID'].'" method="post" class="form" style="margin-top:12px"  onsubmit="disableButton()">';
									print '
									<div class="fielddiv">
										Send message to everyone in the class <input type="radio" name="recOrg" value="'.$_GET['orgID'].'" checked />yes <input type="radio" name="recOrg" value="0" />no 
									</div>
									<div class="fielddiv" style="margin-top: -18px">
										Or send message to a team<br />'; 
										$getTeams = "SELECT teamID, teamName FROM ttteam WHERE orgID=?";
										$teams = $mysqli->execute_query($getTeams, [$_GET['orgID']])->fetch_all(MYSQLI_ASSOC);
										if (count($teams) > 0) {
											foreach($teams as $team_key => $team) {
												print '<input type="radio" name="recTeam" value="'.$team['teamID'].'" />'.$team['teamName'].' <br />';
											}
										}	
									print '</div>
									<div class="fielddiv">
										<div class="fieldname">
											Subject
										</div>
										<div class="fieldvalue">
											<textarea name="subject" class="textarea" style="min-height:40px" maxlength="240" placeholder="message subject" required /></textarea>
										</div>
									</div>
									<div class="fielddiv">
										<div class="fieldname">
											Text
										</div>
										<div class="fieldvalue">
											<textarea name="message" class="textarea" placeholder="message text" required /></textarea>
										</div>
									</div>
									<div class="fielddiv"">
										<div class="fieldname">
										
										</div>
										<div class="fieldvalue">
											<input type="submit" name="submit" class="submitbutton" value="Send" id="btn" />
										</div>
									</div>
									</form>';
								}
								
							print '</div>';
						}
						else print '<div class="contentbox">Not authorized</div>';
					  	
					}
					// set up
					print '<div class="contentbox">';
						if ($_GET['action'] == 'orgnew') {
							print '
							<strong>New Class</strong>
							<form action="teacher.php?action=orgnewcheck" method="post" class="form" onsubmit="disableButton()"> 
							<div class="fielddiv">
								<div class="fieldname">
									Class name
								</div>
								<div class="fieldvalue">
									<input name="orgName" type="text" class="inputtext" maxlength="150" placeholder="must be unique, 150 chars max" required />
								</div>
							</div>
							<div class="fielddiv">
								<div class="fieldname">
								
								</div>
								<div class="fieldvalue">
									<input type="submit" name="submit" class="submitbutton" value="Submit" id="btn" />
								</div>
							</div>
					      	</form>';
						}
						elseif ($_GET['action'] == 'orgnewcheck') {
							$getOrg = "SELECT orgID FROM ttorg WHERE orgName =?";
		        			$orgcheck = $mysqli->execute_query($getOrg, [$_POST['orgName']])->fetch_assoc();
							if (!empty($orgcheck)) {
								// name is taken
								print 'That class name is already taken, please go back and try another.';
							}
							else {
								// insert new class (org)
								$startdate = date('Y-m-d H:i:s');
								$stmt = $mysqli->prepare("INSERT INTO ttorg (orgName, orgCreated, userID) VALUES (?,?,?)");
						  		$stmt->bind_param("ssi", $_POST['orgName'], $startdate, $_SESSION['userID']);
						  		$stmt->execute();
						  		$stmt->close();
						  		// get new orgID and insert teacher after pause
						  		sleep(1);
						  		$getNewOrg = "SELECT orgID, orgName FROM ttorg WHERE orgName=?";
						  		$org = $mysqli->execute_query($getNewOrg, [$_POST['orgName']])->fetch_assoc();
						  		$orgID = $org['orgID'];
						  		$stmt = $mysqli->prepare("INSERT INTO ttorg_mem (orgID, userID) VALUES (?,?)");
				  				$stmt->bind_param("ii", $orgID, $_SESSION['userID']);
				  				$stmt->execute();
				  				$stmt->close();
				  				// display the org name/ID and admin
				  				print 'Congrats, your Class "'; echo stripslashes($org['orgName']); print '" is ready to add Teams and Students<br />
				  				- first name, last name, and team are required to add a student<br />
				  				- use letters only for the names (non-letters will be removed)<br />
				  				- student accounts and teams take up to 24 hours to be active';
				  				print '<form action="teacher.php?action=orgnewmem" method="post" class="form" onsubmit="disableButton()">';
				  				$i = 1;
				  				while ($i<33) {
					  				print '<div style="width:100%; display:inline-block;">
					  					<div style="float:left; width:20px; margin-right:4px; padding-top:4px; text-align:right">'; echo $i; print '</div>
					  					<div style="float:left;">';
					  					print '<input name="firstname[]" type="text" class="inputtext" style="width:150px; margin-right:8px;" placeholder="first" />
					  					<input name="lastname[]" type="text" class="inputtext" style="width:150px; margin-right:8px;" placeholder="last" />
					  					<select name = "teamnum[]" class="select">
											<option value = "1">select team</option>
											<option value = "1">Team 1</option>
											<option value = "2">Team 2</option>
											<option value = "3">Team 3</option>
											<option value = "4">Team 4</option>
											<option value = "5">Team 5</option>
											<option value = "6">Team 6</option>
											<option value = "7">Team 7</option>
											<option value = "8">Team 8</option>
										</select>
					  					</div>
					  				</div>';
					  				$i = $i+1;
					  			}
					  			print '<input type="hidden" name="orgID" value="'.$orgID.'" />
					  			<input type="submit" name="submit" class="submitbutton" style="margin-left:24px; margin-top:8px;" value="Submit" id="btn" />';
							}
						}
						elseif ($_GET['action'] == 'orgnewmem') {
							$firstname = $_POST['firstname'];
							$lastname = $_POST['lastname'];
							$teamnum = $_POST['teamnum'];
							$orgID = $_POST['orgID'];
							$email = "admin@thinkertools.org";
							$student = 1;
							foreach($firstname as $key => $n) {
								if ($n != "" && $lastname[$key] != "" && $teamnum[$key] >0) {
									$first = preg_replace("/[^a-zA-Z]/", '', $n); 
							 		$last = preg_replace("/[^a-zA-Z]/", '', $lastname[$key]);
							 		$teamName = "Team " . $teamnum[$key];
							 		// startdate, fontcolor hex, username, password, email 
							 		$startdate = date('Y-m-d H:i:s');
							 		$red = rand(0,255);
									$green = rand(0,255);
									$blue = rand(0,255);
									$fontcolor = sprintf("#%02x%02x%02x", $red, $green , $blue);
									$hex = ltrim($fontcolor, '#'); 
									$username = $first . $last . $red;
									$password = $last . $fontcolor;
									// insert into ttuser, get userID
							 		$stmt = $mysqli->prepare("INSERT INTO ttuser (username, firstname, lastname, email, password, startdate, fontcolor, student) VALUES (?,?,?,?,?,?,?,?)");
									$stmt->bind_param("sssssssi", $username, $first, $last, $email, $password, $startdate, $fontcolor, $student);
									$stmt->execute();
									$stmt->close();
									sleep(1);
									// get student userID
									$getStudent = "SELECT userID FROM ttuser WHERE username =? and fontcolor =?";
		        					$student = $mysqli->execute_query($getStudent, [$username, $fontcolor])->fetch_assoc();
		        					$studentID = $student['userID'];
		        					// add student to org_mem
		        					$stmt = $mysqli->prepare("INSERT INTO ttorg_mem (orgID, userID) VALUES (?,?)");
					  				$stmt->bind_param("ii", $orgID, $studentID);
					  				$stmt->execute();
					  				$stmt->close();
		        					// add student to team_mem, create team first if needed
							 		$getTeamID = $mysqli->query("SELECT teamID FROM ttteam WHERE orgID=".$orgID." AND teamName ='".$teamName."'");
									if ($getTeamID->num_rows > 0) {
										while ($teamID_row = $getTeamID->fetch_array()) {
											$teamID = $teamID_row['teamID'];
										}
									}
									else {
										$teamCreated = date('Y-m-d H:i:s');
										$stmt = $mysqli->prepare("INSERT INTO ttteam (orgID, teamName, teamCreated, userID) VALUES (?,?,?,?)");
									  	$stmt->bind_param("issi", $orgID, $teamName, $teamCreated, $_SESSION['userID']);
									  	$stmt->execute();
									  	$stmt->close();
									  	sleep(1);
									  	// get new teamID
									  	$getNewTeam = "SELECT teamID FROM ttteam WHERE userID=? AND teamCreated=?";
									  	$newTeam = $mysqli->execute_query($getNewTeam, [$_SESSION['userID'], $teamCreated])->fetch_assoc();
									  	$teamID = $newTeam['teamID'];
									  	// insert teacher into new team
									  	$stmt = $mysqli->prepare("INSERT INTO ttteam_mem (teamID, userID) VALUES (?,?)");
	  									$stmt->bind_param("ii", $teamID, $_SESSION['userID']);
	  									$stmt->execute();
	  									$stmt->close();
									}
									$stmt = $mysqli->prepare("INSERT INTO ttteam_mem (teamID, userID) VALUES (?,?)");
  									$stmt->bind_param("ii", $teamID, $studentID);
  									$stmt->execute();
  									$stmt->close();
  									// email new user
									$to = "admin@thinkertools.org";
									$subject = "A student account has been created";
									$activatelink = "https://thinkertools.us/profile.php?code1=".$studentID."&code2=".$hex."";
									$message = "A student account is ready, but you need to activate it. Please click this link to <a href=".$activatelink.">activate account</a>. <br /><br />";
									$from = "admin@thinkertools.org";
									$headers = "MIME-Version: 1.0" . "\r\n";
									$headers .= "Content-type:text/html;charset=iso-8859-1" . "\r\n";
									$headers .= "From:" . $from . "\r\n";
									mail($to,$subject,$message,$headers);
								}
							}
							print 'Your class  has been set up. The student accounts should be activated within 24 hours. Questions? Email admin@thinkertools.org';
						}
						else {
							print '<strong>Two ways to set up a Class with Teams</strong>
							<br /><br />
							1. Use standard Thinkertools Teams and Organizations setup:<br />
							<div style="width=100%; padding-left:18px">If your Class will have multiple Teams, first set up the Class as an Organization. <a href="teams.php" class="textlink">Teams and Orgs</a></div>
							<div style="width=100%; padding-left:18px; margin-bottom:8px;">Each of the students will need to set up their own account as you did when you set up yours. <a href="profile.php?action=new" class="textlink">Create an Account</a></div>
							2. Use the Class Setup Tool:<br />
							<div style="width=100%; padding-left:18px">You will need to have a class name, number of teams, student names, and know which students go in the teams.</div>
							<div style="width=100%; padding-left:18px;">There is a maximum number of 32 students in a Class and a maximum of 8 Teams. 
							<a href="teacher.php?action=orgnew" class="textlink">Start a Class</a></div>';
						}
					print '</div>';
				}
			print '</div>';
			// right column ============================================================
			print '<div class="column">';
				// display list of plans
				print '<div class="toolbox" style="background-color: #C63232; color: white;">Lesson Plans</div>';
				print '<div class="contentbox" style="margin-top:0px; border-top:none">
					<a href="teacher.php?action=display&platform=plan" class="textlink">view plans</a>';
					if ($teachercheck == 1) print ' | <a href="teacher.php?action=new&platform=plan" class="textlink">create plan</a>';
					// display plan
					if ($_GET['action'] == 'display' && $_GET['platform'] == 'plan') {
						print '<br /><br />';
						// user lesson plans
						$getLessons = "SELECT * FROM lessonplan WHERE userID=?";
						$lessons = $mysqli->execute_query($getLessons, [$_SESSION['userID']])->fetch_all(MYSQLI_ASSOC);
						if (count($lessons) > 0) {
							foreach ($lessons as $lesson_key => $lesson) {
								print '<a href="teacher.php?lessonID='.$lesson['lessonID'].'" class="textlink">'.stripslashes($lesson['subject']).'</a>';
				  				print ' ('; echo $lesson['platform']; print ') ';
				  				print '<a href="teacher.php?action=edit&lessonID='.$lesson['lessonID'].'" class="textlink">edit</a>';
				  				print '<br />';
							}
							print '<br />';
						}
						// all shared plans
						$getLessons = "SELECT * FROM lessonplan WHERE share=1";
						$lessons = $mysqli->execute_query($getLessons)->fetch_all(MYSQLI_ASSOC);
						foreach ($lessons as $lesson_key => $lesson) {
							print '<a href="teacher.php?lessonID='.$lesson['lessonID'].'" class="textlink">'.stripslashes($lesson['subject']).'</a>';
			  				print ' ('; echo $lesson['platform']; print ') ';
			  				print '<br />';
						}
					}
					// display selected lesson plan
					if (isset($_GET['lessonID']) && !isset($_GET['action'])) {
						print '<br /><br />';
						$getLesson = $mysqli->query("SELECT * FROM lessonplan WHERE lessonID=".$_GET['lessonID']."");
				  		if ($getLesson->num_rows > 0) {
				  	  		while ($row_lesson = $getLesson->fetch_array()) {
				  				echo stripslashes($row_lesson['subject']); print '<br />';
								echo $row_lesson['platform']; print '<br />';
								echo $row_lesson['duration']; print ' minutes<br />';
								echo stripslashes($row_lesson['plan']); 
							}
				 	  	}
					}
					// new lesson plan 
					if ($teachercheck == 1 && $_GET['action']=='new') {
					  	print '<br /><br />
					  	<form action="teacher.php?action=insert" method="post" onsubmit="disableButton()">
					  	<div class="fielddiv">
							<div class="fieldname">
								Platform
							</div>
							<div class="fieldvalue">';
								print '<select name="platform" class="inputtext" style="height:36px; width:420px" required>';
								print '<option value="Web of Inquiry">Web of Inquiry</option>';
								print '<option value="Quipx">Quipx</option>';
								// print '<option value="General">General Thinkertools</option>';
								print '</select>';
							print '</div>
						</div>
						<div class="fielddiv">
							<div class="fieldname">
								Subject
							</div>
							<div class="fieldvalue">';
								print '<textarea name="subject" class="textarea" placeholder="subject"></textarea>';
							print '</div>
						</div>
						<div class="fielddiv">
							<div class="fieldname">
								Duration
							</div>
							<div class="fieldvalue">';
								print '<select name="duration" class="inputtext" style="height:36px; width:420px" required>';
								print '<option value="15">15 minutes</option>';
								print '<option value="30">30 minutes</option>';
								print '<option value="45">45 minutes</option>';
								print '<option value="60">60 minutes</option>';
								print '<option value="90">90 minutes</option>';
								print '</select>';
							print '</div>
						</div>
						<div class="fielddiv">
							<div class="fieldname">
								Share
							</div>
							<div class="fieldvalue">
								<input name="share" type="radio" value="1" checked /> share 
								<input name="share" type="radio" value="0" /> don\'t share';
							print '</div>
						</div>
						<boardtext id="plan" name="plan">'.$plan.'</boardtext>
					  	<br />
						<div class="fielddiv">
							<div class="fieldname">
							
							</div>
							<div class="fieldvalue">
								<input type="submit" name="submit" class="submitbutton" value="Submit" id="btn" />
							</div>
						</div>
					  	</form>';
				  	}
				  	// edit lesson plan
					if (isset($_GET['lessonID']) && $_GET['action']=='edit') {
						print '<br /><br />';
						// check if userID
						$getLesson = "SELECT * FROM lessonplan WHERE lessonID=? AND userID=?";
						$lesson = $mysqli->execute_query($getLesson, [$_GET['lessonID'], $_SESSION['userID']])->fetch_assoc(); 
						// error
						if (count($lesson)==0) print 'You must be the creator of this lesson plan to edit it.';
						// edit
						else {
					  		$subject = stripslashes($lesson['subject']);
					  		$platform = $lesson['platform'];
					  		$duration = $lesson['duration'];
					  		$share = $lesson['share'];
					  		$plan = stripslashes($lesson['plan']); 
			  				print '<form action="teacher.php?action=update&lessonID='.$_GET['lessonID'].'" method="post" onsubmit="disableButton()">
				  				<div class="fielddiv">
									<div class="fieldname">
										Platform
									</div>
									<div class="fieldvalue">';
										print '<select name="platform" class="inputtext" style="height:36px; width:420px" required>';
										if (isset($_GET['action']) && $_GET['action'] == "edit") {
											print '<option value="'.$platform.'">'.$platform.'</option>';
										}
										print '<option value="Web of Inquiry">Web of Inquiry</option>';
										print '<option value="Quipx">Quipx</option>';
										// print '<option value="General">General Thinkertools</option>';
										print '</select>';
									print '</div>
								</div>
				  				<div class="fielddiv">
									<div class="fieldname">
										Subject
									</div>
									<div class="fieldvalue">';
										print '<textarea name="subject" class="textarea" placeholder="subject">'.$subject.'</textarea>';
									print '</div>
								</div>
								<div class="fielddiv">
									<div class="fieldname">
										Duration
									</div>
									<div class="fieldvalue">';
										print '<select name="duration" class="inputtext" style="height:36px; width:420px" required>';
										if (isset($_GET['action']) && $_GET['action'] == "edit") {
											print '<option value="'.$duration.'">'.$duration.' minutes</option>';
										}
										print '<option value="15">15 minutes</option>';
										print '<option value="30">30 minutes</option>';
										print '<option value="45">45 minutes</option>';
										print '<option value="60">60 minutes</option>';
										print '<option value="90">90 minutes</option>';
										print '</select>';
									print '</div>
								</div>
								<div class="fielddiv">
									<div class="fieldname">
										Share
									</div>
									<div class="fieldvalue">';
										if ($share == 1) print '<input name="share" type="radio" value="1" checked /> share <input name="share" type="radio" value="0" /> don\'t share';
										else print '<input name="share" type="radio" value="1" /> share <input name="share" type="radio" value="0" checked /> don\'t share';
									print '</div>
								</div>
								<boardtext id="plan" name="plan">'.$plan.'</boardtext>
							  	<br />
								<div class="fielddiv">
									<div class="fieldname">
									
									</div>
									<div class="fieldvalue">
										<input type="submit" name="submit" class="submitbutton" value="Submit" id="btn" />
									</div>
								</div>
					  		</form>';
						}
					}
				print '</div>';
				// woi
				print '<div class="toolbox" style="background-color: #C63232; color: white;">Web of Inquiry</div>';
				print '<div class="contentbox" style="margin-top:0px; border-top:none">';
					if ($teachercheck == 1) {
						print '<a href="teacher.php?action=display&platform=woi" class="textlink">view games</a> | 
						<a href="teacher.php?action=create&platform=woi" class="textlink">create game</a>';
					}
					// view WoI games
					if ($_GET['action'] == 'display' && $_GET['platform'] == 'woi') {
						require('webofinquiry/woidb.php');
						$getGames = "SELECT game_id, game_name, game_description, teamID FROM game WHERE game_creator=?";
						$games = $mysqli->execute_query($getGames, [$_SESSION['userID']])->fetch_all(MYSQLI_ASSOC);
						if (count($games) > 0) { 
							print '<br /><br />';
							foreach($games as $game_key => $game) {
								print '<strong>'; echo stripslashes($game['game_name']); print '</strong><br />';
								echo stripslashes($game['game_description']); print '<br />'; 
								// team name
								require('accountsdb.php');
								$getTeamName = "SELECT teamName FROM ttteam WHERE teamID=?";
								$teamName = $mysqli->execute_query($getTeamName, [$game['teamID']])->fetch_assoc();
								echo $teamName['teamName']; print '<br />';
							  	print '<a href="webofinquiry/board.php?game_id='.$game['game_id'].'" class="textlink">play game</a> | 
							  	<a href="webofinquiry/home.php?game_id='.$game['game_id'].'" class="textlink">view game grid</a>  |
							  	<a href="webofinquiry/design.php?action=edit&game_id='.$game['game_id'].'" class="textlink">modify game</a><br /><br />';
							}
						}
					}
					// create WoI game - insert
					if ($_GET['action'] == 'insertnew' && $_GET['platform'] == 'woi') {
						$startDateTime = date('Y-m-d H:i:s');
						require('webofinquiry/woidb.php');
		    	  		$stmt = $mysqli->prepare("INSERT INTO game (template_id, game_creator, teamID, game_start, game_name, game_description, game_public) VALUES (?,?,?,?,?,?,?)");
		    	  		$stmt->bind_param("iiisssi", $_POST['template_id'], $_SESSION['userID'], $_POST['teamID'], $startDateTime, $_POST['game_name'], $_POST['game_description'], $_POST['game_public']);
				  		$stmt->execute();
				  		$stmt->close();
				  		require('accountsdb.php');
				  		print '<br /><br />Inquiry game created';
					}
					// create WoI game - form
					if ($_GET['action'] == 'create' && $_GET['platform'] == 'woi') { 
						print '<form action="teacher.php?action=insertnew&platform=woi" method="post" class="form" onsubmit="disableButton()"> 
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
									<textarea name="game_description" class="textarea" placeholder="additional inquiry question description" required /></textarea>
								</div>
							</div>';
							require('webofinquiry/woidb.php');
							print '<div style="margin-top:-12px; margin-bottom:18px; line-height:18px; ">Select a game to answer the inquiry question. The games are in three categories-structural, functional, process. Visit <a href="webofinquiry/library.php" target="_blank" class="textlink">Library and Resources</a> for more information. Or design a new game <a href="webofinquiry/design.php" target="_blank" class="textlink">here</a>.</div>';
							print '<select name="template_id" class="inputtext" style="min-height:40px; width:512px; border: solid 1px gray; outline:none; margin-bottom:24px">';
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
						  	print '</select>
							<div class="fielddiv" style="margin-top:24px">
								<div class="fieldname">
									Team
								</div>
								<div class="fieldvalue fieldvaluebox">';
									// teams by classes
									require('accountsdb.php');
									$getClasses = "SELECT orgID, orgName FROM ttorg WHERE userID =?";
									$classes = $mysqli->execute_query($getClasses, [$_SESSION['userID']])->fetch_all(MYSQLI_ASSOC);	
									foreach ($classes as $class_key => $class) {	
										echo stripslashes($class['orgName']); print '<br />';
										$getTeams = "SELECT teamID, teamName FROM ttteam WHERE orgID=?";
										$teams = $mysqli->execute_query($getTeams, [$class['orgID']])->fetch_all(MYSQLI_ASSOC);
										if (count($teams) > 0) {
											foreach ($teams as $team_key => $team) { 
												// print ' - '; echo stripslashes($team['teamName']); print '<br />';
												print '<input name="teamID" type="radio" value="'.$team['teamID'].'" required>
												'.stripslashes($team['teamName']).'<br />';
											}
										}
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
							<br />
							<div class="fielddiv">
								<div class="fieldname">
								
								</div>
								<div class="fieldvalue">
									<input type="submit" name="submit" class="submitbutton" value="Submit" id="btn" />
								</div>
							</div>
						</form>';	
					}
				print '</div>';
				// quipx
				print '<div class="toolbox" style="background-color: #C63232; color: white;">Quipx</div>';
				print '<div class="contentbox" style="margin-top:0px; border-top:none">';
					if ($teachercheck == 1) {
						print '<a href="teacher.php?action=display&platform=quipx" class="textlink">view sessions</a> | 
						<a href="teacher.php?action=create&platform=quipx" class="textlink">create session</a> <br />';
					}
					// view quipx
					if ($_GET['action'] == 'display' && $_GET['platform'] == 'quipx') {
						require('quipx/qxdb.php');
						$getSessions = "SELECT sessionID, subject, teamID FROM session WHERE userID=?";
					    $sessions = $mysqli->execute_query($getSessions, [$_SESSION['userID']])->fetch_all(MYSQLI_ASSOC);
					    if (!empty($sessions)) {
							print '<br />';
							foreach($sessions as $session_key => $session){
								print '<strong>';echo stripslashes($session['subject']); print '</strong><br />';
							   	require('accountsdb.php');
								$getTeamName = "SELECT teamName FROM ttteam WHERE teamID=?";
								$teamName = $mysqli->execute_query($getTeamName, [$session['teamID']])->fetch_assoc();
								echo $teamName['teamName']; print '<br />';
								print '<a href="quipx/discuss.php?sessionID='.$session['sessionID'].'" class="textlink">join session</a> | <a href="quipx/modify.php?action=edit&sessionID='.$session['sessionID'].'" class="textlink">modify session</a>';
								print '<br /><br />';
					  		}
					  	}
					}
					// insert a new session
					if ($_GET['action'] == 'insertnew' && $_GET['platform'] == 'quipx') {
						$created = date('Y-m-d H:i:s');
						require "quipx/qxdb.php";
						$stmt = $mysqli->prepare("INSERT INTO session (userID, teamID, subject, created, month, day, year, hour, minute, ampm, zone, duration_hours, duration_minutes, objectives) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)");
					  	$stmt->bind_param("iissssssssssss", $_SESSION['userID'], $_POST['teamID'], $_POST['subject'], $created, $_POST['month'], $_POST['day'], $_POST['year'], $_POST['hour'], $_POST['minute'], $_POST['ampm'], $_POST['zone'], $_POST['duration_hours'], $_POST['duration_minutes'], $_POST['objectives']);
					  	$stmt->execute();
					  	$stmt->close();
			  			print '<br />Quipx sesssion created';
					}
					// create Quipx session - form
					if ($_GET['action'] == 'create' && $_GET['platform'] == 'quipx') {
						print '
						<form action="teacher.php?action=insertnew&platform=quipx" method="post" class="form" onsubmit="disableButton()"> 
						<div class="fielddiv">
							<div class="fieldname">
								Subject
							</div>
							<div class="fieldvalue">
								<input name="subject" type="text" class="inputtext" maxlength="250" placeholder="session topic 250 chars max" required />
							</div>
						</div>
						<div class="fielddiv">
							<div class="fieldname">
								Objectives
							</div>
							<div class="fieldvalue">
								<textarea name="objectives" class="textarea" placeholder="session objectives" required /></textarea>
							</div>
						</div>
						<div class="fielddiv">
							<div class="fieldname">
								Team
							</div>
							<div class="fieldvalue fieldvaluebox">';
								// teams by classes
								$getClasses = "SELECT orgID, orgName FROM ttorg WHERE userID =?";
								$classes = $mysqli->execute_query($getClasses, [$_SESSION['userID']])->fetch_all(MYSQLI_ASSOC);	
								foreach ($classes as $class_key => $class) {	
									echo stripslashes($class['orgName']); print '<br />';
									$getTeams = "SELECT teamID, teamName FROM ttteam WHERE orgID=?";
									$teams = $mysqli->execute_query($getTeams, [$class['orgID']])->fetch_all(MYSQLI_ASSOC);
									if (count($teams) > 0) {
										foreach ($teams as $team_key => $team) { 
											// print ' - '; echo stripslashes($team['teamName']); print '<br />';
											print '<input name="teamID" type="radio" value="'.$team['teamID'].'" required>
											'.stripslashes($team['teamName']).'<br />';
										}
									}
								}
							print '</div>
						</div>
						<div class="fielddiv">
							<div class="fieldname">
								Date
							</div>
							<div class="fieldvalue fieldvaluebox">
								<select name = "month" class="select selectblack">
									<option value = "0">month</option>
									<option value = "1">January</option>
									<option value = "2">February</option>
									<option value = "3">March</option>
									<option value = "4">April</option>
									<option value = "5">May</option>
									<option value = "6">June</option>
									<option value = "7">July</option>
									<option value = "8">August</option>
									<option value = "9">September</option>
									<option value = "10">October</option>
									<option value = "11">November</option>
									<option value = "12">December</option>
								</select>
								<select name = "day" class="select selectblack">
									<option value = "0">day</option>';
									for($counter = 01; $counter <= 31; $counter++) {
										print '<option value ="'.$counter.'">'.$counter.'</option>';
									}
								print '</select>
								<select name = "year" class="select selectblack">
									<option value = "2025">year</option>
									<option value = "2025">2025</option>
									<option value = "2026">2026</option>
									<option value = "2027">2027</option>
								</select>
							</div>
						</div>
						<div class="fielddiv">
							<div class="fieldname">
								Time
							</div>
							<div class="fieldvalue fieldvaluebox">
								<select name = "hour" class="select selectblack">
									<option value = "0">hour</option>';
									for($counter = 1; $counter <= 12; $counter++) {
										print '<option value ="'.$counter.'">'.$counter.'</option>';
									}
								print '</select>
								<select name = "minute" class="select selectblack">
									<option value = "00">min</option>
									<option value = "00">00</option>
									<option value = "15">15</option>
									<option value = "30">30</option>
									<option value = "45">45</option>
								</select>
								<select name = "ampm" class="select selectblack">
									<option value = "0">am/pm</option>
									<option value = "AM">AM</option>
									<option value = "PM">PM</option>
								</select>
								<select name = "zone" class="select selectblack">
									<option value = "none">US zone</option>
									<option value = "ET">ET</option>
									<option value = "CT">CT</option>
									<option value = "PT">PT</option>
									<option value = "AK">AK</option>
									<option value = "HI">HI</option>
								</select>
							</div>
						</div>
						<div class="fielddiv">
							<div class="fieldname">
								Duration
							</div>
							<div class="fieldvalue fieldvaluebox">
								<select name = "duration_hours" class="select selectblack">
									<option value = "0">hours</option>
									<option value = "0">0</option>
									<option value = "1">1</option>
									<option value = "2">2</option>
									<option value = "3">3</option>
									<option value = "4">4</option>
								</select>
								<select name = "duration_minutes" class="select selectblack">
									<option value = "00">minutes</option>
									<option value = "00">00</option>
									<option value = "15">15</option>
									<option value = "30">30</option>
									<option value = "45">45</option>
								</select>
							</div>
						</div>
			      		<div class="fielddiv"">
							<div class="fieldname">
							
							</div>
							<div class="fieldvalue">
								<input type="submit" name="submit" class="submitbutton" value="Submit" id="btn" />
							</div>
						</div>
						</form>
						';
					}
				print '</div>';
				// teacher support team messages
				print '<div class="toolbox" style="background-color: #C63232; color: white;">Teacher Support Team Messages</div>';
				print '<div class="contentbox" style="margin-top:0px; border-top:none">';
					if ($teachercheck == 1) {
						print '<a href="teacher.php?action=display&platform=messages" class="textlink">view messages</a> | 
						<a href="teacher.php?action=send&platform=messages" class="textlink">send message</a>';
					}
					// view messages
					if ($_GET['action'] == 'display' && $_GET['platform'] == 'messages') {
						$getMessages = "SELECT subject, senderName, sentTime, message FROM message WHERE recTeam=121 ORDER BY messageID DESC";
						$messages = $mysqli->execute_query($getMessages)->fetch_all(MYSQLI_ASSOC);
						if (!empty($messages)) {
							print '<br /><br />';
							foreach($messages as $message_key => $message) {
								print 'Subject: <strong>'; echo stripslashes($message['subject']); print '</strong><br />';
								print 'Sender: '; echo stripslashes($message['senderName']); print '<br />';
								print 'Sent: '; echo $message['sentTime']; print ' ET<br />';
								print 'Message: '; echo stripslashes($message['message']); print '<br />';
								print '<br />';
							}
						}
					}
					// insert message
					if ($_GET['action'] == 'sendinsert') {
						$recOrg = 0;
						$recInd = 0;
						$recAll = 0;
						$game_id = 0;
						$sessionID = 0;
						$sentTime = date('Y-m-d H:i:s');
						$recTeam = 121;
						// senderName
						$getName = "SELECT firstname, lastname FROM ttuser WHERE userID =?";
			        	$name = $mysqli->execute_query($getName, [$_SESSION['userID']])->fetch_assoc();
						$senderName = stripslashes($name['firstname']) . " " . stripslashes($name['lastname']);
						// insert
						$stmt = $mysqli->prepare("INSERT INTO message (subject, message, sentTime, senderID, senderName, recInd, recTeam, recOrg, recAll, game_id, sessionID) VALUES (?,?,?,?,?,?,?,?,?,?,?)");
					  	$stmt->bind_param("sssisiiiiii", $_POST['subject'], $_POST['message'], $sentTime, $_SESSION['userID'], $senderName, $recInd, $recTeam, $recOrg, $recAll, $game_id, $sessionID);
					  	$stmt->execute();
					  	$stmt->close();
					  	print '<br /><br />Message sent';
					}
					// send message form
					if ($_GET['action'] == 'send') {
						print '<form action="teacher.php?action=sendinsert&platform=messages" method="post" class="form" onsubmit="disableButton()">
						<div class="fielddiv">
							<div class="fieldname">
								Subject
							</div>
							<div class="fieldvalue">
								<textarea name="subject" class="textarea" style="min-height:40px" maxlength="240" placeholder="message subject" required /></textarea>
							</div>
						</div>
						<div class="fielddiv">
							<div class="fieldname">
								Text
							</div>
							<div class="fieldvalue">
								<textarea name="message" class="textarea" placeholder="message text" required /></textarea>
							</div>
						</div>
						<div class="fielddiv"">
							<div class="fieldname">
							
							</div>
							<div class="fieldvalue">
								<input type="submit" name="submit" class="submitbutton" value="Send" id="btn" />
							</div>
						</div>
						</form>';		
					}
				print '</div>';
			print '</div>';
	  	?>
		</div>	
	</body>
</html>
<script>
    function disableButton() {
        var btn = document.getElementById('btn');
        btn.disabled = true;
        btn.innerText = 'Posting...'
    }
</script>