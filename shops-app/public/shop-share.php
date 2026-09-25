<?php
/**
 * Serves Open Graph / Twitter Card meta tags AND real per-shop
 * title/description/canonical, with the shop's own logo as the preview
 * image, to social-media link-preview crawlers and search-engine
 * crawlers (WhatsApp, Facebook, Twitter, LinkedIn, Googlebot, Bingbot, etc).
 *
 * Same rationale as listing-share.php -- see that file's comment. This
 * covers /shop/{slug}, the other large chunk (224 URLs) of the sitemap
 * that was previously served byte-identical, uncanonicalized HTML.
 *
 * Real visitors never see this page -- the .htaccess rewrite only sends
 * known crawler user-agents here; everyone else still gets the normal SPA.
 */

$slug = isset($_GET['slug']) ? preg_replace('/[^a-zA-Z0-9-]/', '', $_GET['slug']) : '';

$siteName = 'Suqafuran';
$fallbackImage = 'https://suqafuran.com/og-image.png';
$canonicalUrl = $slug !== '' ? "https://suqafuran.com/shop/{$slug}" : 'https://suqafuran.com';

$title = "Suqafuran - Africa's Marketplace";
$description = "Buy and sell locally on Suqafuran -- browse thousands of products from local sellers and shops, or list your own.";
$image = $fallbackImage;
$notFound = false;

if ($slug !== '') {
    $ch = curl_init("https://app.suqafuran.com/api/v1/listings/shops/{$slug}");
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 5,
        CURLOPT_HTTPHEADER => ['Accept: application/json'],
    ]);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode === 404) {
        // Shop slug doesn't resolve to any verified shop with active
        // listings. Without this, the SPA's always-200 catch-all would
        // make Googlebot see 200 + generic shell content -- a soft 404.
        $notFound = true;
    } elseif ($response !== false && $httpCode === 200) {
        $shop = json_decode($response, true);
        if (is_array($shop)) {
            $shopName = $shop['shop_name'] ?? '';
            if ($shopName !== '') {
                $title = $shopName . ' | ' . $siteName;
            }

            $listingCount = $shop['listing_count'] ?? null;
            $address = $shop['shop_address'] ?? '';
            $descParts = [];
            if ($listingCount) {
                $descParts[] = $listingCount . ' listing' . ($listingCount == 1 ? '' : 's');
            }
            if ($address) {
                $descParts[] = "in {$address}";
            }
            $description = $shopName !== ''
                ? trim("Shop {$shopName} on Suqafuran" . ($descParts ? ' -- ' . implode(' ', $descParts) : '') . '.')
                : "Check out this shop on Suqafuran.";

            if (!empty($shop['logo_url'])) {
                $image = $shop['logo_url'];
            } elseif (!empty($shop['cover_image'])) {
                $image = $shop['cover_image'];
            }
        }
    }
}

if ($notFound) {
    http_response_code(404);
}

function og_escape($value) {
    return htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
}
?>
<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title><?= og_escape($title) ?></title>
<meta name="description" content="<?= og_escape($description) ?>" />
<link rel="canonical" href="<?= og_escape($canonicalUrl) ?>" />

<meta property="og:type" content="website" />
<meta property="og:site_name" content="<?= og_escape($siteName) ?>" />
<meta property="og:title" content="<?= og_escape($title) ?>" />
<meta property="og:description" content="<?= og_escape($description) ?>" />
<meta property="og:image" content="<?= og_escape($image) ?>" />
<meta property="og:url" content="<?= og_escape($canonicalUrl) ?>" />

<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="<?= og_escape($title) ?>" />
<meta name="twitter:description" content="<?= og_escape($description) ?>" />
<meta name="twitter:image" content="<?= og_escape($image) ?>" />
</head>
<body>
<p><a href="<?= og_escape($canonicalUrl) ?>">View this shop on Suqafuran</a></p>
</body>
</html>
