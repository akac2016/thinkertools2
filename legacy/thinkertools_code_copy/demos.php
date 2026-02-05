<?php session_start();
?>
<!DOCTYPE html>
<html lang="en">
	<head>
		<meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
		<title>Thinkertools demos</title>
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
			?>
			<div class="column">
				<br /><br />
				<div class="toolbox woi" style="margin-top: -24px;">
					<a href="webofinquiry/home.php" class="toollink">Web of Inquiry</a>
				</div>
				<div class="contentbox">
					<div class="demorow" style="text-align: center;">
						<video width="520px" controls>
							<source src="images/woidemos/WOI_demo.mp4" type="video/mp4">
						</video> 
					</div>
				</div>
				<div class="contentbox">
					<?php
					if (!isset($_GET['woi']) || $_GET['woi']==1) { 
						print '<div id="a" class="demorow">
							<img src="images/woidemos/WOI_demo1.jpg" width="520px" alt="web of inquiry demo 1" />
							<br />
							<div style="width:100%; display:block-inline;">
								<div style="float:left"> </div>
								<div style="float:right"><a href="demos.php?woi=2#a" class="textlink">next</a> ></div>
							</div>
						</div>';
					}
					if ($_GET['woi']==2) { 
						print '<div id="a" class="demorow">
							<img src="images/woidemos/WOI_demo2.jpg" width="520px" alt="web of inquiry demo 2" />
							<br />
							<div style="width:100%; display:block-inline;">
								<div style="float:left">< <a href="demos.php?woi=1#a" class="textlink">back</a></div>
								<div style="float:right"><a href="demos.php?woi=3#a" class="textlink">next</a> ></div>
							</div>
						</div>';
					}
					if ($_GET['woi']==3) { 
						print '<div id="a" class="demorow">
							<img src="images/woidemos/WOI_demo3.jpg" width="520px" alt="web of inquiry demo 3" />
							<br />
							<div style="width:100%; display:block-inline;">
								<div style="float:left">< <a href="demos.php?woi=2#a" class="textlink">back</a></div>
								<div style="float:right"><a href="demos.php?woi=4#a" class="textlink">next</a> ></div>
							</div>
						</div>';
					}
					if ($_GET['woi']==4) { 
						print '<div id="a" class="demorow">
							<img src="images/woidemos/WOI_demo4.jpg" width="520px" alt="web of inquiry demo 4" />
							<br />
							<div style="width:100%; display:block-inline;">
								<div style="float:left">< <a href="demos.php?woi=3#a" class="textlink">back</a></div>
								<div style="float:right"><a href="demos.php?woi=5#a" class="textlink">next</a> ></div>
							</div>
						</div>';
					}
					if ($_GET['woi']==5) { 
						print '<div id="a" class="demorow">
							<img src="images/woidemos/WOI_demo5.jpg" width="520px" alt="web of inquiry demo 5" />
							<br />
							<div style="width:100%; display:block-inline;">
								<div style="float:left">< <a href="demos.php?woi=4#a" class="textlink">back</a></div>
								<div style="float:right"><a href="demos.php?woi=6#a" class="textlink">next</a> ></div>
							</div>
						</div>';
					}
					if ($_GET['woi']==6) { 
						print '<div id="a" class="demorow">
							<img src="images/woidemos/WOI_demo6.jpg" width="520px" alt="web of inquiry demo 6" />
							<br />
							<div style="width:100%; display:block-inline;">
								<div style="float:left">< <a href="demos.php?woi=5#a" class="textlink">back</a></div>
								<div style="float:right"><a href="demos.php?woi=7#a" class="textlink">next</a> ></div>
							</div>
						</div>';
					}
					if ($_GET['woi']==7) { 
						print '<div id="a" class="demorow">
							<img src="images/woidemos/WOI_demo7.jpg" width="520px" alt="web of inquiry demo 7" />
							<br />
							<div style="width:100%; display:block-inline;">
								<div style="float:left">< <a href="demos.php?woi=6#a" class="textlink">back</a></div>
								<div style="float:right"><a href="demos.php?woi=8#a" class="textlink">next</a> ></div>
							</div>
						</div>';
					}
					if ($_GET['woi']==8) { 
						print '<div id="a" class="demorow">
							<img src="images/woidemos/WOI_demo8.jpg" width="520px" alt="web of inquiry demo 8" />
							<br />
							<div style="width:100%; display:block-inline;">
								<div style="float:left">< <a href="demos.php?woi=7#a" class="textlink">back</a></div>
								<div style="float:right"><a href="demos.php?woi=9#a" class="textlink">next</a> ></div>
							</div>
						</div>';
					}
					if ($_GET['woi']==9) { 
						print '<div id="a" class="demorow">
							<img src="images/woidemos/WOI_demo9.jpg" width="520px" alt="web of inquiry demo 9" />
							<br />
							<div style="width:100%; display:block-inline;">
								<div style="float:left">< <a href="demos.php?woi=8#a" class="textlink">back</a></div>
								<div style="float:right"><a href="demos.php?woi=10#a" class="textlink">next</a> ></div>
							</div>
						</div>';
					}
					if ($_GET['woi']==10) { 
						print '<div id="a" class="demorow">
							<img src="images/woidemos/WOI_demo10.jpg" width="520px" alt="web of inquiry demo 10" />
							<br />
							<div style="width:100%; display:block-inline;">
								<div style="float:left">< <a href="demos.php?woi=9#a" class="textlink">back</a></div>
								<div style="float:right"></div>
							</div>
						</div>';
					}
					?>
				</div>
			</div>
			<div class="column">
				<br /><br />
				<div class="toolbox quipx" style="margin-top: -24px;">
					<a href="quipx/home.php" class="toollink">Quipx</a>
				</div>
				<div class="contentbox">
					<div class="demorow" style="text-align: center;">
						<video width="520px" controls>
							<source src="images/quipxdemos/quipx_demo.mp4" type="video/mp4">
						</video> 
					</div>
				</div>
				<div class="contentbox">
					<?php
					if (!isset($_GET['qx']) || $_GET['qx']==1) { 
						print '<div id="a" class="demorow">
							<img src="images/quipxdemos/quipx_demo1.jpg" width="520px" alt="quipx demo 1" />
							<br />
							<div style="width:100%; display:block-inline;">
								<div style="float:left"> </div>
								<div style="float:right"><a href="demos.php?qx=2#a" class="textlink">next</a> ></div>
							</div>
						</div>';
					}
					if ($_GET['qx']==2) { 
						print '<div id="a" class="demorow">
							<img src="images/quipxdemos/quipx_demo2.jpg" width="520px" alt="quipx demo 2" />
							<br />
							<div style="width:100%; display:block-inline;">
								<div style="float:left">< <a href="demos.php?qx=1#a" class="textlink">back</a></div>
								<div style="float:right"><a href="demos.php?qx=3#a" class="textlink">next</a> ></div>
							</div>
						</div>';
					}
					if ($_GET['qx']==3) { 
						print '<div id="a" class="demorow">
							<img src="images/quipxdemos/quipx_demo3.jpg" width="520px" alt="quipx demo 3" />
							<br />
							<div style="width:100%; display:block-inline;">
								<div style="float:left">< <a href="demos.php?qx=2#a" class="textlink">back</a></div>
								<div style="float:right"><a href="demos.php?qx=4#a" class="textlink">next</a> ></div>
							</div>
						</div>';
					}
					if ($_GET['qx']==4) { 
						print '<div id="a" class="demorow">
							<img src="images/quipxdemos/quipx_demo4.jpg" width="520px" alt="quipx demo 4" />
							<br />
							<div style="width:100%; display:block-inline;">
								<div style="float:left">< <a href="demos.php?qx=3#a" class="textlink">back</a></div>
								<div style="float:right"><a href="demos.php?qx=5#a" class="textlink">next</a> ></div>
							</div>
						</div>';
					}
					if ($_GET['qx']==5) { 
						print '<div id="a" class="demorow">
							<img src="images/quipxdemos/quipx_demo5.jpg" width="520px" alt="quipx demo 5" />
							<br />
							<div style="width:100%; display:block-inline;">
								<div style="float:left">< <a href="demos.php?qx=4#a" class="textlink">back</a></div>
								<div style="float:right"><a href="demos.php?qx=6#a" class="textlink">next</a> ></div>
							</div>
						</div>';
					}
					if ($_GET['qx']==6) { 
						print '<div id="a" class="demorow">
							<img src="images/quipxdemos/quipx_demo6.jpg" width="520px" alt="quipx demo 6" />
							<br />
							<div style="width:100%; display:block-inline;">
								<div style="float:left">< <a href="demos.php?qx=5#a" class="textlink">back</a></div>
								<div style="float:right"><a href="demos.php?qx=7#a" class="textlink">next</a> ></div>
							</div>
						</div>';
					}
					if ($_GET['qx']==7) { 
						print '<div id="a" class="demorow">
							<img src="images/quipxdemos/quipx_demo7.jpg" width="520px" alt="quipx demo 7" />
							<br />
							<div style="width:100%; display:block-inline;">
								<div style="float:left">< <a href="demos.php?qx=6#a" class="textlink">back</a></div>
								<div style="float:right"><a href="demos.php?qx=8#a" class="textlink">next</a> ></div>
							</div>
						</div>';
					}
					if ($_GET['qx']==8) { 
						print '<div id="a" class="demorow">
							<img src="images/quipxdemos/quipx_demo8.jpg" width="520px" alt="quipx demo 8" />
							<br />
							<div style="width:100%; display:block-inline;">
								<div style="float:left">< <a href="demos.php?qx=7#a" class="textlink">back</a></div>
								<div style="float:right"><a href="demos.php?qx=9#a" class="textlink">next</a> ></div>
							</div>
						</div>';
					}
					if ($_GET['qx']==9) { 
						print '<div id="a" class="demorow">
							<img src="images/quipxdemos/quipx_demo9.jpg" width="520px" alt="quipx demo 9" />
							<br />
							<div style="width:100%; display:block-inline;">
								<div style="float:left">< <a href="demos.php?qx=8#a" class="textlink">back</a></div>
								<div style="float:right"><a href="demos.php?qx=10#a" class="textlink">next</a> ></div>
							</div>
						</div>';
					}
					if ($_GET['qx']==10) { 
						print '<div id="a" class="demorow">
							<img src="images/quipxdemos/quipx_demo10.jpg" width="520px" alt="quipx demo 10" />
							<br />
							<div style="width:100%; display:block-inline;">
								<div style="float:left">< <a href="demos.php?qx=9#a" class="textlink">back</a></div>
								<div style="float:right"></div>
							</div>
						</div>';
					}
					?>
				</div>
			</div>
		</div>
	</body>
</html>
