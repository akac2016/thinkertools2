<?php session_start();
// discussion entries 
$entryNumCheck = 0;
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
print '<a id="b"></a>';
if (count($entries) > $_SESSION['entryNum']) {
	$_SESSION['entryNum'] = count($entries);
	// focus on discuss form
	print 
	'<script type="text/javascript"> 
	location.href = "#b"; 
	document.myForm.discussEntry.focus();
	</script>';
}
?>
