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
	// send message
	if ($_GET['action'] == "message") {
		// sender name
		require('../accountsdb.php');
		$getName = "SELECT firstname, lastname FROM ttuser WHERE userID =?";
		$name = $mysqli->execute_query($getName, [$_SESSION['userID']])->fetch_assoc();
		$senderName = $name['firstname'] . " " . $name['lastname'];
		// teamID
		require('qxdb.php');
		$getTeam = "SELECT teamID FROM session WHERE sessionID=?";
		$team = $mysqli->execute_query($getTeam, [$_SESSION['sessionID']])->fetch_assoc();
		$teamID = $team['teamID'];
		// message values
		$sentTime = date('Y-m-d H:i:s');
		$subject = "Quipx session comment";
		$recInd = 0;  
		$recOrg = 0; 
		$recAll = 0;
		$game_id = 0;
		require('../accountsdb.php');
		$stmt = $mysqli->prepare("INSERT INTO message (subject, message, sentTime, senderID, senderName, recInd, recTeam, recOrg, recAll, game_id, sessionID) VALUES (?,?,?,?,?,?,?,?,?,?,?)");
	  	$stmt->bind_param("sssisiiiiii", $subject, $_POST['message'], $sentTime, $_SESSION['userID'], $senderName, $recInd, $teamID, $recOrg, $recAll, $game_id, $_SESSION['sessionID']);
	  	$stmt->execute();
	  	$stmt->close();
	}
?>
<!DOCTYPE html>
<html lang="en">
	<head>
		<meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
		<title>Quipx review</title>
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
					<div class="sessionnavcircle done"></div>
					Reflect
				</div>
				<div class="sessionnavcirclediv">
					<div class="sessionnavcircle done"></div>
					Improve
				</div>
				<div class="sessionnavcirclediv">
					<div class="sessionnavcircle current"></div>
					Review
				</div>
				<?php 
					$loc = "'home.php'" ;
					print ' <button class="button150 finishmargin" onclick="window.location.href='.$loc.';">Finish review</button>';
				?>
			</div>
			<div class="column">
				<?php
					if (isset($_SESSION['userID']) && $teamcheck == 1 && $sessioncheck == 1) {
						// relect item list, average
						print '
						<div class="contentbox quipxborder">';
							require('qxdb.php');
							$meanhigh = 1;
							$meanlow = 5;
							$getReflectItems = $mysqli->query("SELECT reflectItemID, reflectItem FROM reflect_item");
							while ($item_row = $getReflectItems->fetch_array()) {
								print '<div class="selectitemdiv">
									<div class="left">';
										echo stripslashes($item_row['reflectItem']);
										// stats initialize 
										$order = 0;
										$selectTotal = 0;
										$selectMean = 0;
										$getSelect = "SELECT reflectSelect FROM reflect_select WHERE sessionID=? AND reflectItemID=?";
										$selects = $mysqli->execute_query($getSelect, [$_SESSION['sessionID'], $item_row['reflectItemID']])->fetch_all(MYSQLI_ASSOC);
										$countselects = count($selects);
										if ($countselects > 0) {
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
						print '</div>';
						// high = strength
						print '<div class="contentbox quipxborder">';
							print '<strong>Strength</strong> <br />';
							require('qxdb.php');
							$getReflectItem = "SELECT reflectItem FROM reflect_item WHERE reflectItemID=?";
							$reflectItem = $mysqli->execute_query($getReflectItem, [$itemhigh])->fetch_assoc();
							echo stripslashes($reflectItem['reflectItem']); print '<br />';
							// justify
							$getJustify = "SELECT reflectJustify FROM reflect_select WHERE sessionID=? AND reflectItemID=?";
							$justifys = $mysqli->execute_query($getJustify, [$_SESSION['sessionID'], $itemhigh])->fetch_all(MYSQLI_ASSOC) ;
							foreach ($justifys as $key => $justify) {
								if ($justify['reflectJustify'] != "") {
									print '"'; echo stripslashes($justify['reflectJustify']); print '"<br />';
								}
							}
						print '</div>';
						// low = weakness
						print '<div class="contentbox quipxborder">';
							print '<strong>Weakness</strong> <br />';
							require('qxdb.php');
							$getReflectItem = "SELECT reflectItem FROM reflect_item WHERE reflectItemID=?";
							$reflectItem = $mysqli->execute_query($getReflectItem, [$itemlow])->fetch_assoc();
							echo stripslashes($reflectItem['reflectItem']); print '<br />';
							// justify
							$getJustify = "SELECT reflectJustify FROM reflect_select WHERE sessionID=? AND reflectItemID=?";
							$justifys = $mysqli->execute_query($getJustify, [$_SESSION['sessionID'], $itemlow])->fetch_all(MYSQLI_ASSOC);
							foreach ($justifys as $key => $justify) {
								if ($justify['reflectJustify'] != "") {
									print '"'; echo stripslashes($justify['reflectJustify']); print '"<br />';
								}
							}
							print '<br />';
							// strategy
							$getResponseID = "SELECT reflectResponseID FROM reflect_response WHERE reflectItemID=? AND reflectResponseOrder=?";
							$response = $mysqli->execute_query($getResponseID, [$itemlow, $meanlow])->fetch_assoc();
							 $reflectResponseID = $response['reflectResponseID'];
							$getStrategy = "SELECT strategy FROM improve_strategy WHERE reflectResponseID=?";
							$strategy = $mysqli->execute_query($getStrategy, [$response['reflectResponseID']])->fetch_assoc();
							echo stripslashes($strategy['strategy']); print '<br />';
						print '</div>';
						print '<div class="contentbox quipxborder" style="float: left; height: 400px; overflow-y: auto; ">
							<div class="contentboxtitle">Comments <a href="review.php" class="textlink">refresh</a></div> 
							<form action="review.php?action=message" method="post" class="form" onsubmit="disableButton()">
								<textarea name="message" class="textarea" placeholder="type comment" style="min-width: 490px; margin-bottom:12px" required /></textarea>
								<input type="submit" name="submit" class="submitbutton" value="Enter" id="btn" />
							</form>
							<br /><br />';
							require('../accountsdb.php');
							$getMessages = "SELECT * FROM message WHERE sessionID=? ORDER BY messageID DESC";
							$messages = $mysqli->execute_query($getMessages, [$_SESSION['sessionID']])->fetch_all(MYSQLI_ASSOC);
							foreach ($messages as $key => $message) {
								echo stripslashes($message['senderName']); print ' ';
								echo $message['sentTime']; print ' ET<br />';
								echo stripslashes($message['message']); 
								print '<br /><br />';
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
										echo $user['firstname']; print ' '; echo $user['lastname'];
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
									print '<span style="color:'.$mem['fontcolor'].';  -webkit-text-stroke-width: .25px; -webkit-text-stroke-color: #000000;">';
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
<script>
    function disableButton() {
        var btn = document.getElementById('btn');
        btn.disabled = true;
        btn.innerText = 'Posting...'
    }
</script>