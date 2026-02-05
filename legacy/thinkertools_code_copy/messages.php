<?php session_start(); 
	// user account db
	require('accountsdb.php');
	// initialize message variables
	$subject = "";
	$text = "";
	$check = 1;
	// send
	if ($_GET['action'] == "send") {
		// individual check email
		if (isset($_POST['recInd'])) {
			$getUser = "SELECT userID FROM ttuser WHERE username =? OR email =?";
			$user = $mysqli->execute_query($getUser, [$_POST['recInd'], $_POST['recInd']])->fetch_assoc();
			if (!empty($user)) {
				$recInd = $user['userID'];
			}
			else {
				$check = 0;
				$subject = $_POST['subject'];
				$text = $_POST['message'];
			}
		}
		else $recInd = 0;
		// team
		if (isset($_POST['recTeam'])) $recTeam = $_POST['recTeam'];
		else $recTeam = 0;
		//org
		if (isset($_POST['recOrg'])) $recOrg = $_POST['recOrg'];
		else $recOrg = 0;
		// all
		if (isset($_POST['recAll'])) $recAll = $_POST['recAll'];
		else $recAll = 0;
		// send if check=1 
		if ($check == 1) {
			$sentTime = date('Y-m-d H:i:s');
			// senderName
			$getName = "SELECT firstname, lastname FROM ttuser WHERE userID =?";
        	$name = $mysqli->execute_query($getName, [$_SESSION['userID']])->fetch_assoc();
			$senderName = stripslashes($name['firstname']) . " " . stripslashes($name['lastname']);
			// set game, session = 0
			$game_id = 0;
			$sessionID = 0;
			// insert message
			$stmt = $mysqli->prepare("INSERT INTO message (subject, message, sentTime, senderID, senderName, recInd, recTeam, recOrg, recAll, game_id, sessionID) VALUES (?,?,?,?,?,?,?,?,?,?,?)");
		  	$stmt->bind_param("sssisiiiiii", $_POST['subject'], $_POST['message'], $sentTime, $_SESSION['userID'], $senderName, $recInd, $recTeam, $recOrg, $recAll, $game_id, $sessionID);
		  	$stmt->execute();
		  	$stmt->close();
		}
	}		
?>
<!DOCTYPE html>
<html lang="en">
	<head>
		<meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
		<title>Thinkertools messages</title>
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
							<a href="login.php" class="toollink">Log in to see messages</a>
						</div>
					</div>';
				}
				else {
					print '
					<div class="column">';
						if ($_GET['action'] == "send" && $check == 0) {
							print '<div class="contentbox"> Sorry, there\'s no account with that username or email. Please check and re-enter. </div>';
						}
						if ($_GET['action'] == "send" && $check == 1) {
							print '<div class="contentbox"> Message sent! <a href="messages.php" class="textlink">Send another</a>.</div>';
						}
						// recipient form
						if (!isset($_GET['action'])) {
							print '
							<br />Select your message recipient type
							<form action="messages.php?action=rec" method="post" class="form">
							<div class="fielddiv">
								<div class="fieldname">
									Type
								</div>
								<div class="fieldvalue">
									<select name = "recType" class="fieldvaluebox">
									<option value = "ind">individual</option>';
									// check if on team
									$getTeams = "SELECT teamID FROM ttteam_mem WHERE userID =?";
				        			$teams = $mysqli->execute_query($getTeams, [$_SESSION['userID']])->fetch_all(MYSQLI_ASSOC);
				        			if (!empty($teams)) {
										print '<option value = "team">team</option>';
									}
									// check if org admin
									$getOrgs = "SELECT orgID FROM ttorg WHERE userID =?";
				        			$orgs = $mysqli->execute_query($getOrgs, [$_SESSION['userID']])->fetch_all(MYSQLI_ASSOC);
				        			if (!empty($orgs)) {
										print '<option value = "org">organization</option>';
									}
									if ($_SESSION['userID'] == 5 || $_SESSION['userID'] == 108) {
										print '<option value = "all">all</option>';
									}
									print' </select>
								</div>
							</div>
							<div class="fielddiv">
								<div class="fieldname">
								
								</div>
								<div class="fieldvalue">
									<input type="submit" name="submit" class="submitbutton" value="Select" />
								</div>
							</div>
							</form>';
						}
						// message form
						if ($_GET['action'] == "rec" || ($_GET['action'] == "send" && $check == 0)) {				
							print '<form action="messages.php?action=send" method="post" class="form" onsubmit="disableButton()">';
							// all users, admin only
							if ($_POST['recType'] == "all") {
								print 'Message to everyone <br /><br />
								<input type="hidden" name="recAll" value="100" />';
							}
							// individual
							if ($_POST['recType'] == "ind" || $check == 0) {
								print '<div class="fielddiv">
									<div class="fieldname">
										To Individual
									</div>
									<div class="fieldvalue">
										<input name="recInd" type="text" class="inputtext" maxlength="200" placeholder="individual email or username" />
									</div>
								</div>';
							}
							// team 
							if ($_POST['recType'] == "team") {
								print '<div class="fielddiv">
									<div class="fieldname">
										To a Team
									</div>
									<div class="fieldvalue">';
										print '<select name = "recTeam" class="fieldvaluebox">';
										// teamID and teamName
										$getTeams = "SELECT teamID FROM ttteam_mem WHERE userID =?";
			        					$teams = $mysqli->execute_query($getTeams, [$_SESSION['userID']])->fetch_all(MYSQLI_ASSOC);
			        					if (!empty($teams)) {
											foreach($teams as $team) {
												foreach($team as $team_key => $teamID){
													$getTeam = "SELECT teamName FROM ttteam WHERE teamID =?";
			        								$teamname = $mysqli->execute_query($getTeam, [$teamID])->fetch_assoc();
			        								foreach($teamname as $name_key => $name){
														$name = stripslashes($name);
														print '<option value = '.$teamID.'>'.$name.'</option>';
													}
												}
											}
										}
										print '</select>';
									print '</div>
								</div>';
							}
							if ($_POST['recType'] == "org") {
								print '<div class="fielddiv">
									<div class="fieldname">
										To an Org
									</div>
									<div class="fieldvalue">';
										print '<select name = "recOrg" class="fieldvaluebox">';
										// orgID and orgName
										$getOrgs = "SELECT orgID, orgName FROM ttorg WHERE userID =?";
			        					$orgs = $mysqli->execute_query($getOrgs, [$_SESSION['userID']])->fetch_all(MYSQLI_ASSOC);
			        					if (!empty($orgs)) {
											foreach($orgs as $org_key => $org){
												$orgname = stripslashes($org['orgName']);
												print '<option value = '.$org['orgID'].'>'.$orgname.'</option>';
											}
										}
										print '</select>';
									print '</div>
								</div>';
							}
							print '<div class="fielddiv">
								<div class="fieldname">
									Subject
								</div>
								<div class="fieldvalue">
									<textarea name="subject" class="textarea" style="min-height:40px" maxlength="240" placeholder="message subject" required />'.$subject.'</textarea>
								</div>
							</div>
							<div class="fielddiv">
								<div class="fieldname">
									Text
								</div>
								<div class="fieldvalue">
									<textarea name="message" class="textarea" placeholder="message text" required />'.$text.'</textarea>
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
					print '</div>
					<div class="column">
						<div class="contentbox">';
							print '<div class="contentboxtitle">Messages <a href="messages.php" class="textlink">refresh</a><br /><br /></div>';
							// individuals or all
							print '<div style="width: 100%; height: 30px; background-color: #C63232; text-align: center; padding-top: 4px; color: white; margin-bottom: 12px">Individual</div>';
							$getMessages = "SELECT * FROM message WHERE recInd=? OR recAll=100 ORDER BY messageID DESC";
							$messages = $mysqli->execute_query($getMessages, [$_SESSION['userID']])->fetch_all(MYSQLI_ASSOC);
							if (!empty($messages)) {
								foreach($messages as $message) {
									print 'Subject: <strong>'; echo stripslashes($message['subject']); print '</strong><br />';
									print 'Sender: '; echo stripslashes($message['senderName']); print '<br />';
									print 'Sent: '; echo $message['sentTime']; print ' ET<br />';
									print 'Message: '; echo stripslashes($message['message']); 
									print '<br /><br />';
								}
							}
							// teams
							print '<div style="width: 100%; height: 30px; background-color: #C63232; text-align: center; padding-top: 4px; color: white; margin-bottom: 12px">Teams</div>';
							// sort messages by messageID
							$messageArray= array();
							$getTeams = "SELECT teamID FROM ttteam_mem WHERE userID =?";
        					$teams = $mysqli->execute_query($getTeams, [$_SESSION['userID']])->fetch_all(MYSQLI_ASSOC);
							foreach($teams as $team) {
								foreach($team as $team_key => $teamID){
									$getMessages = "SELECT messageID FROM message WHERE recTeam=? AND game_id=0 AND sessionID=0 ORDER BY messageID DESC";
									$messages = $mysqli->execute_query($getMessages, [$teamID])->fetch_all(MYSQLI_ASSOC);
									if (!empty($messages)) {
										foreach($messages as $message_key => $message) {
											array_push($messageArray, $message);
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
							// orgs
							print '<div style="width: 100%; height: 30px; background-color: #C63232; text-align: center; padding-top: 4px; color: white; margin-bottom: 12px">Organizations</div>';
							// sort messages by messgeID
							$messageArray= array();
							$getOrgs = "SELECT orgID FROM ttorg_mem WHERE userID =?";
        					$orgs = $mysqli->execute_query($getOrgs, [$_SESSION['userID']])->fetch_all(MYSQLI_ASSOC);
							foreach($orgs as $org) {
								foreach($org as $org_key => $orgID){
									$getMessages = "SELECT messageID FROM message WHERE recOrg=? ORDER BY messageID DESC";
									$messages = $mysqli->execute_query($getMessages, [$orgID])->fetch_all(MYSQLI_ASSOC);
									if (!empty($messages)) {
										foreach($messages as $message_key => $message) {
											array_push($messageArray, $message);
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
							// teams
							print '<div style="width: 100%; height: 30px; background-color: #C63232; text-align: center; padding-top: 4px; color: white; margin-bottom: 12px">Games and Sessions</div>';
							// sort messages by messageID
							$messageArray= array();
							$getTeams = "SELECT teamID FROM ttteam_mem WHERE userID =?";
        					$teams = $mysqli->execute_query($getTeams, [$_SESSION['userID']])->fetch_all(MYSQLI_ASSOC);
							foreach($teams as $team) {
								foreach($team as $team_key => $teamID){
									$getMessages = "SELECT messageID FROM message WHERE recTeam=? AND (game_id>0 OR sessionID>0) ORDER BY messageID DESC";
									$messages = $mysqli->execute_query($getMessages, [$teamID])->fetch_all(MYSQLI_ASSOC);
									if (!empty($messages)) {
										foreach($messages as $message_key => $message) {
											array_push($messageArray, $message);
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
						print '</div>
					</div>
					';
				}
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
