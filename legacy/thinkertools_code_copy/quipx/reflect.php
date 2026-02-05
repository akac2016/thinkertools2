<?php session_start();
	// user account db
	// require('../accountsdb.php');
	// quipx db
	// require('qxdb.php');
	// initialize check variables
	$sessioncheck = 0;
	$teamcheck = 0;
	// check if getsessionID is set, set sessionID
	if (isset($_GET['sessionID'])) $_SESSION['sessionID'] = $_GET['sessionID'];
	if (isset($_SESSION['sessionID']) && isset($_SESSION['userID'])) $sessioncheck = 1;
	if ($sessioncheck == 1) {
		// check if user is on team
		require('qxdb.php');
		$getTeam = "SELECT teamID FROM session WHERE sessionID=?";
		$team = $mysqli->execute_query($getTeam, [$_SESSION['sessionID']])->fetch_assoc();
		require('../accountsdb.php');
		$checkTeamMem = "SELECT teammemID FROM ttteam_mem WHERE teamID=? AND userID=?";
		$mem = $mysqli->execute_query($checkTeamMem, [$team['teamID'], $_SESSION['userID']])->fetch_assoc();
		if (!empty($mem)) {
			$teamcheck = 1;
	 	}
	}
?>
<!DOCTYPE html>
<html lang="en">
	<head>
		<meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
		<title>Quipx reflect</title>
		<link rel="stylesheet" href="../main.css" content="text/html; charset=utf-8"/>
		<link rel="stylesheet" href="qx.css" content="text/html; charset=utf-8"/>
		<!-- main head and dropdown menu -->
		<meta name="viewport" content="width=device-width, initial-scale=1">
		<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">
		<link rel="stylesheet" href="../mainhead.css" content="text/html; charset=utf-8"/>
	</head>
	<body>
		<div class="container">
			<?php
				require('mainhead.php');
			?>
			<div class="qlogodiv">
				<a href="home.php" class="qlogo">Quipx</a>
			</div>
			<div class="sessionnavdiv">
				<div class="sessionnavcirclediv">
					<div class="sessionnavcircle done"></div>
					Discuss
				</div>
				<div class="sessionnavcirclediv">
					<div class="sessionnavcircle current"></div>
					Reflect
				</div>
				<div class="sessionnavcirclediv">
					<div class="sessionnavcircle next"></div>
					Improve
				</div>
				<div class="sessionnavcirclediv">
					<div class="sessionnavcircle next"></div>
					Review
				</div>
				<?php 
					$loc = "'improve.php'" ;
					print ' <button class="button150 finishmargin" onclick="window.location.href='.$loc.';">Finish reflect</button>';
				?>
			</div>
			<div class="column">
				<?php
					if (isset($_SESSION['userID']) && $teamcheck == 1 && $sessioncheck == 1) {
						// update reflect select and justify
						if ($_GET['action'] == "update") {
							require "qxdb.php";
							$stmt = $mysqli->prepare("DELETE FROM reflect_select WHERE sessionID=? AND reflectItemID=? AND userID=?");
  							$stmt->bind_param("iii", $_SESSION['sessionID'], $_GET['reflectItemID'], $_SESSION['userID']);
  							$stmt->execute();
  							$stmt->close();
							// insert new values
							$stmt = $mysqli->prepare("INSERT INTO reflect_select (sessionID, reflectItemID, userID, reflectSelect, reflectJustify) VALUES (?,?,?,?,?)");
						  	$stmt->bind_param("iiiis", $_SESSION['sessionID'], $_GET['reflectItemID'], $_SESSION['userID'], $_POST['reflectSelect'], $_POST['reflectJustify']);
						  	$stmt->execute();
						  	$stmt->close();
						}
						// relect item list, status
						print '
						<div class="contentbox quipxborder">';
							require('qxdb.php');
							$getReflectItems = $mysqli->query("SELECT reflectItemID, reflectItem FROM reflect_item");
							if ($getReflectItems->num_rows > 0) {
								while ($item_row = $getReflectItems->fetch_array()) {
									print '
									<div class="selectitemdiv">
										<div class="left">
											<a href="reflect.php?reflectItemID='.$item_row['reflectItemID'].'" class="textlink">'.$item_row['reflectItem'].'</a> ';
											$selectitem = 0;
											$getSelect = "SELECT reflectSelect FROM reflect_select WHERE sessionID=? AND reflectItemID=? AND userID=?";
											$select = $mysqli->execute_query($getSelect, [$_SESSION['sessionID'], $item_row['reflectItemID'], $_SESSION['userID']])->fetch_assoc();
											if (!empty($select)) {
												$selectitem = $select['reflectSelect'];
											}
										print '</div>
										<div class="right">';
											if ($selectitem > 0) print '<div class="selectitemlistcircle filled"></div>';
											else print '<div class="selectitemlistcircle"></div>';
											if ($selectitem > 1) print '<div class="selectitemlistcircle filled"></div>';
											else print '<div class="selectitemlistcircle"></div>';
											if ($selectitem > 2) print '<div class="selectitemlistcircle filled"></div>';
											else print '<div class="selectitemlistcircle"></div>';
											if ($selectitem > 3) print '<div class="selectitemlistcircle filled"></div>';
											else print '<div class="selectitemlistcircle"></div>';
											if ($selectitem > 4) print '<div class="selectitemlistcircle filled"></div>';
											else print '<div class="selectitemlistcircle"></div>';
										print '</div>
									</div>';
								}
							}
						print '</div>';
						// item form
						print '
						<div class="contentbox quipxborder">';
							if (isset($_GET['reflectItemID'])) {
							 	require('qxdb.php');
								$getReflectItem = "SELECT * FROM reflect_item WHERE reflectItemID=?";
								$reflectItem = $mysqli->execute_query($getReflectItem, [$_GET['reflectItemID']])->fetch_assoc();
					 			print '<strong>'; echo stripslashes($reflectItem['reflectItem']); print '</strong>';
					 			if (isset($_GET['action']) && $_GET['action'] == "expand") {
					 				print '<button class="expandbutton"><a href="reflect.php?reflectItemID='.$_GET['reflectItemID'].'" class="expandlink">Expand -</a></button>
					 				<br /><br />';
					 				echo stripslashes($reflectItem['reflectItemDesc']);
					 			}
					 			else { 
					 				print '<button class="expandbutton"><a href="reflect.php?reflectItemID='.$_GET['reflectItemID'].'&action=expand" class="expandlink">Expand +</a></button>
					 				<br /><br />';
					 				echo stripslashes($reflectItem['reflectItemShort']);
					 			}
					 			// check for existing select
								$select = 0;
								$justify = "";
								$getSelectResponse = "SELECT reflectSelect, reflectJustify FROM reflect_select WHERE sessionID=? AND reflectItemID=? AND userID=?";
								$selectResponse = $mysqli->execute_query($getSelectResponse, [$_SESSION['sessionID'], $reflectItem['reflectItemID'], $_SESSION['userID']])->fetch_assoc();
								$select = $selectResponse['reflectSelect'];
								$justify = stripslashes($selectResponse['reflectJustify']);
					 			print '<br /><br />
					 			<form action="reflect.php?action=update&reflectItemID='.$_GET['reflectItemID'].'" method="post">';
					 				$getReflectResponses = "SELECT * FROM reflect_response WHERE reflectItemID=? ORDER BY reflectResponseOrder ASC";
					 				$responses = $mysqli->execute_query($getReflectResponses, [$reflectItem['reflectItemID']])->fetch_all(MYSQLI_ASSOC);
					 				foreach ($responses as $response_key => $response) {
						 				// responses
										$checked = "";
										if (isset($_GET['action']) && $_GET['action'] == "expand") {
											if ($response['reflectResponseOrder'] == $select) $checked = "checked";
											print '<input type="radio" name="reflectSelect" value="'.$response['reflectResponseOrder'].'" '.$checked.' required />';
											echo $response['reflectResponseOrder']; print ': '; 
											echo stripslashes($response['reflectResponse']); 
											print '</input>';
											print '<br /><br />';
										}
										else {
											if ($response['reflectResponseOrder'] == $select) $checked = "checked";
											print '<input type="radio" name="reflectSelect" value="'.$response['reflectResponseOrder'].'" '.$checked.' required />';
											echo $response['reflectResponseOrder']; print ' '; 
											print '</input>';
										}
						 			}
									// comments
									if (isset($_GET['action']) && $_GET['action'] == "expand") print '<br />';
									else print '<br /><br />';
									print '<div class="fielddiv">
										<div class="fieldname">
											Comments
										</div>
										<div class="fieldvalue">
											<textarea name="reflectJustify" class="textarea" placeholder="add details to justify your score" />'.$justify.'</textarea>
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
							else {
								print 'Select a reflect item above';
							}
						print '</div>';
					}
				?>
			</div>
			<div class="column">
				<?php
					if (!isset($_SESSION['userID'])) {
						print '<div class="toolbox login">
						<a href="../login.php" class="toollink">Login to get started </a>
						</div>';
					}
					elseif ($sessioncheck == 0) {
						print '<div class="toolbox login">
						You must join a session to participate. <br /> <a href="join.php" class="textlink">See available sessions.</a>
						</div>';
					}
					elseif ($teamcheck == 0) {
						print '<div class="toolbox login">
						You must be a team member to participate. <br /> Contact the session creator to add you.
						</div>';
					}
					else {
						print '
						<div class="contentbox quipxborder">';
							require('qxdb.php');
							// total number of entries and words
							$entry_count = 0;
							$word_count = 0;
							$getEntries = "SELECT entry FROM session_discuss WHERE sessionID=?";
							$entries = $mysqli->execute_query($getEntries, [$_SESSION['sessionID']])->fetch_all(MYSQLI_ASSOC);
							if (count($entries) > 0) {
								$entry_count = count($entries); 
								foreach ($entries as $entrykey => $entry) {
									$word_count = $word_count + str_word_count($entry['entry']);
								}
							}
							// session info
							$getSession = "SELECT subject, objectives, teamID FROM session WHERE sessionID=?";
							$session = $mysqli->execute_query($getSession, [$_SESSION['sessionID']])->fetch_assoc();
							print '<strong>'; echo stripslashes($session['subject']); print '</strong><br />';
							echo stripslashes($session['objectives']); print '<br /><br />'; 
							// team
							require('../accountsdb.php');
							$getTeam = "SELECT teamName FROM ttteam WHERE teamID=?";
							$team = $mysqli->execute_query($getTeam, [$session['teamID']])->fetch_assoc();
							print '<strong>'; echo stripslashes($team['teamName']); print '</strong> ';
							print 'entries/words '; echo $entry_count; print '/';  echo $word_count; 
							print ' 100/100% 100 score<br /><br />';
							// members
							$getMembers = "SELECT userID FROM ttteam_mem WHERE teamID=?";
							$mems = $mysqli->execute_query($getMembers, [$session['teamID']])->fetch_all(MYSQLI_ASSOC);
							foreach ($mems as $mem_key => $mem) {				
								print '<div style="width:500px; display:inline-block; clear: both">
									<div style=float:left; width:240px">';
										require('../accountsdb.php');
										$getUser = "SELECT firstname, lastname, fontcolor FROM ttuser WHERE userID=?";
										$user = $mysqli->execute_query($getUser, [$mem['userID']])->fetch_assoc();
										print '<span style="color: '.$user['fontcolor'].'; -webkit-text-stroke-width: .25px; -webkit-text-stroke-color: #000000;">'; 
										echo $user['firstname']; print ' '; $user['lastname'];
										print '</span>
									</div>
									<div style=float:right; width:240px">'; 
										// get participation and score
										require('qxdb.php');
										$participant_entry_count = 0;
										$participant_word_count = 0;
										$getParticipantEntries = "SELECT entry FROM session_discuss WHERE sessionID=? AND userID=?";
										$participantEntries = $mysqli->execute_query($getParticipantEntries, [$_SESSION['sessionID'], $mem['userID']])->fetch_all(MYSQLI_ASSOC);
										$participant_entry_count = count($participantEntries); 
										foreach ($participantEntries as $participantentrykey => $participantentry) {
											$participant_word_count = $participant_word_count + str_word_count($participantentry['entry']);
										}
										// averages
										$entry_average = round($participant_entry_count/$entry_count,2)*100;
										$word_average = round($participant_word_count/$word_count,2)*100;
										// display totals and averages
										print ' '; echo $participant_entry_count; print '/';  echo $participant_word_count; 
										print ' '; echo $entry_average; print '/';  echo $word_average; print '% ';
										echo ($entry_average+$word_average)/2; print ' score';
										print '<br />';
								print '</div></div>';
							}
						print '</div>';
						print '<div class="contentbox quipxborder discussbox">';
							require('qxdb.php');
							$getEntries = "SELECT sessionID, userID, entry FROM session_discuss WHERE sessionID=? ORDER BY discussID ASC";
							$entries = $mysqli->execute_query($getEntries, [$_SESSION['sessionID']])->fetch_all(MYSQLI_ASSOC);
							if (!empty($entries)) {
								foreach ($entries as $entry_key => $entry) {
									require('../accountsdb.php');
									$getMem = "SELECT firstname, fontcolor FROM ttuser WHERE userID=?";
									$mem = $mysqli->execute_query($getMem, [$entry['userID']])->fetch_assoc();
									print '<span style="color:'.$mem['fontcolor'].'; -webkit-text-stroke-width: .25px; -webkit-text-stroke-color: #000000;">';
									echo $mem['firstname'];
									print "</span><br />";
									echo stripslashes($entry['entry']);
									print "<br /><br />";
								}
							}
						print '</div>';
					}
				?> 
			</div>
		</div>
	</body>
</html>
