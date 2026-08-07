/**
 * UK postcode outcode matching — fast filter without radial distance math.
 * User types e.g. M1 or SW1A; events match same or adjacent city outcode sectors.
 */
(function () {
  var UK_OUTCODE_RE = /\b([A-Z]{1,2}\d{1,2}[A-Z]?)/i;

  /** Sector = letters + leading digit(s) before optional trailing letter (SW1A → SW1, M14 → M1). */
  function parseOutcode(raw) {
    if (!raw) return '';
    var text = String(raw).trim().toUpperCase();
    var spacedMatch = text.match(/\b([A-Z]{1,2}\d{1,2}[A-Z]?)\s+\d[A-Z]{2}\b/);
    if (spacedMatch) return spacedMatch[1];
    var compact = text.replace(/\s+/g, '');
    var withoutInward = compact.replace(/(\d[A-Z]{2})$/, '');
    var m = withoutInward.match(/^([A-Z]{1,2}\d{1,2}[A-Z]?)/);
    return m ? m[1] : '';
  }

  /** District = letter+digit(s) before optional trailing letter (SE10 → SE10, SW1A → SW1). */
  function sectorOf(outcode) {
    if (!outcode) return '';
    var m = outcode.match(/^([A-Z]{1,2}\d{1,2})([A-Z])?/);
    if (!m) return outcode;
    return m[1];
  }

  /** Same city / region — adjacent outcode sectors for filtering. */
  var REGION_SECTORS = {
    manchester: [
      'M1', 'M2', 'M3', 'M4', 'M5', 'M6', 'M7', 'M8', 'M9',
      'M11', 'M12', 'M13', 'M14', 'M15', 'M16', 'M17', 'M18', 'M19',
      'M20', 'M21', 'M22', 'M23', 'M24', 'M25', 'M26', 'M27', 'M28', 'M29',
      'M30', 'M31', 'M32', 'M33', 'M34', 'M35', 'M38', 'M40', 'M41', 'M43',
      'M44', 'M45', 'M46', 'M50', 'M60', 'M90',
    ],
    london: [
      'E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8', 'E9', 'E10', 'E11', 'E12', 'E13', 'E14', 'E15', 'E16', 'E17', 'E18', 'E20',
      'EC1', 'EC2', 'EC3', 'EC4',
      'N1', 'N2', 'N3', 'N4', 'N5', 'N6', 'N7', 'N8', 'N9', 'N10', 'N11', 'N12', 'N13', 'N14', 'N15', 'N16', 'N17', 'N18', 'N19', 'N20', 'N21', 'N22',
      'NW1', 'NW2', 'NW3', 'NW4', 'NW5', 'NW6', 'NW7', 'NW8', 'NW9', 'NW10', 'NW11',
      'SE1', 'SE2', 'SE3', 'SE4', 'SE5', 'SE6', 'SE7', 'SE8', 'SE9', 'SE10', 'SE11', 'SE12', 'SE13', 'SE14', 'SE15', 'SE16', 'SE17', 'SE18', 'SE19', 'SE20', 'SE21', 'SE22', 'SE23', 'SE24', 'SE25', 'SE26', 'SE27', 'SE28',
      'SW1', 'SW2', 'SW3', 'SW4', 'SW5', 'SW6', 'SW7', 'SW8', 'SW9', 'SW10', 'SW11', 'SW12', 'SW13', 'SW14', 'SW15', 'SW16', 'SW17', 'SW18', 'SW19', 'SW20',
      'W1', 'W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8', 'W9', 'W10', 'W11', 'W12', 'W13', 'W14',
      'WC1', 'WC2',
      'CR0', 'CR2', 'CR3', 'CR4', 'CR5', 'CR6', 'CR7', 'CR8', 'CR9',
      'BR1', 'BR2', 'BR3', 'BR4', 'BR5', 'BR6', 'BR7', 'BR8',
      'SM1', 'SM2', 'SM3', 'SM4', 'SM5', 'SM6',
      'KT1', 'KT2', 'KT3', 'KT4', 'KT5', 'KT6',
      'DA1', 'DA5', 'DA6', 'DA7', 'DA8', 'DA14', 'DA15', 'DA16', 'DA17', 'DA18',
    ],
    'central-london': ['E1', 'EC1', 'EC2', 'EC3', 'EC4', 'N1', 'NW1', 'SE1', 'SW1', 'W1', 'WC1', 'WC2'],
    'north-london': ['N2', 'N3', 'N4', 'N5', 'N6', 'N7', 'N8', 'N9', 'N10', 'N11', 'N12', 'N13', 'N14', 'N15', 'N16', 'N17', 'N18', 'N19', 'N20', 'N21', 'N22', 'NW2', 'NW3', 'NW4', 'NW5', 'NW6', 'NW7', 'NW8', 'NW9', 'NW10', 'NW11'],
    'south-london': ['SE2', 'SE3', 'SE4', 'SE5', 'SE6', 'SE7', 'SE8', 'SE9', 'SE10', 'SE11', 'SE12', 'SE13', 'SE14', 'SE15', 'SE16', 'SE17', 'SE18', 'SE19', 'SE20', 'SE21', 'SE22', 'SE23', 'SE24', 'SE25', 'SE26', 'SE27', 'SE28', 'SW2', 'SW3', 'SW4', 'SW5', 'SW6', 'SW7', 'SW8', 'SW9', 'SW10', 'SW11', 'SW12', 'SW13', 'SW14', 'SW15', 'SW16', 'SW17', 'SW18', 'SW19', 'SW20', 'CR0', 'CR2', 'CR3', 'CR4', 'CR5', 'CR6', 'CR7', 'CR8', 'CR9', 'BR1', 'BR2', 'BR3', 'BR4', 'BR5', 'BR6', 'BR7', 'BR8', 'SM1', 'SM2', 'SM3', 'SM4', 'SM5', 'SM6', 'KT1', 'KT2', 'KT3', 'KT4', 'KT5', 'KT6', 'DA1', 'DA5', 'DA6', 'DA7', 'DA8', 'DA14', 'DA15', 'DA16', 'DA17', 'DA18'],
    'east-london': ['E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8', 'E9', 'E10', 'E11', 'E12', 'E13', 'E14', 'E15', 'E16', 'E17', 'E18', 'E20'],
    'west-london': ['W2', 'W3', 'W4', 'W5', 'W6', 'W7', 'W8', 'W9', 'W10', 'W11', 'W12', 'W13', 'W14'],
    birmingham: ['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9', 'B10', 'B11', 'B12', 'B13', 'B14', 'B15', 'B16', 'B17', 'B18', 'B19', 'B20', 'B21', 'B23', 'B24', 'B25', 'B26', 'B27', 'B28', 'B29', 'B30', 'B31', 'B32', 'B33', 'B34', 'B35', 'B36', 'B37', 'B38', 'B40', 'B42', 'B43', 'B44', 'B45', 'B46', 'B47', 'B48', 'B49', 'B50', 'B60', 'B61', 'B62', 'B63', 'B64', 'B65', 'B66', 'B67', 'B68', 'B69', 'B70', 'B71', 'B72', 'B73', 'B74', 'B75', 'B76', 'B77', 'B78', 'B79', 'B80', 'B90', 'B91', 'B92', 'B93', 'B94', 'B95', 'B96', 'B97', 'B98'],
    leeds: ['LS1', 'LS2', 'LS3', 'LS4', 'LS5', 'LS6', 'LS7', 'LS8', 'LS9', 'LS10', 'LS11', 'LS12', 'LS13', 'LS14', 'LS15', 'LS16', 'LS17', 'LS18', 'LS19', 'LS20', 'LS21', 'LS22', 'LS23', 'LS24', 'LS25', 'LS26', 'LS27', 'LS28', 'LS29'],
    liverpool: ['L1', 'L2', 'L3', 'L4', 'L5', 'L6', 'L7', 'L8', 'L9', 'L10', 'L11', 'L12', 'L13', 'L14', 'L15', 'L16', 'L17', 'L18', 'L19', 'L20', 'L21', 'L22', 'L23', 'L24', 'L25', 'L26', 'L27', 'L28', 'L29', 'L30', 'L31', 'L32', 'L33', 'L34', 'L35', 'L36', 'L37', 'L38', 'L39', 'L40'],
    bristol: ['BS1', 'BS2', 'BS3', 'BS4', 'BS5', 'BS6', 'BS7', 'BS8', 'BS9', 'BS10', 'BS11', 'BS13', 'BS14', 'BS15', 'BS16', 'BS20', 'BS21', 'BS22', 'BS23', 'BS24', 'BS25', 'BS26', 'BS27', 'BS28', 'BS29', 'BS30', 'BS31', 'BS32', 'BS34', 'BS35', 'BS36', 'BS37', 'BS39', 'BS40', 'BS41', 'BS48', 'BS49'],
    edinburgh: ['EH1', 'EH2', 'EH3', 'EH4', 'EH5', 'EH6', 'EH7', 'EH8', 'EH9', 'EH10', 'EH11', 'EH12', 'EH13', 'EH14', 'EH15', 'EH16', 'EH17', 'EH18', 'EH19', 'EH20', 'EH21', 'EH22', 'EH23', 'EH24', 'EH25', 'EH26', 'EH27', 'EH28', 'EH29', 'EH30', 'EH31', 'EH32', 'EH33', 'EH34', 'EH35', 'EH36', 'EH37', 'EH38', 'EH39', 'EH40', 'EH41', 'EH42', 'EH43', 'EH44', 'EH45', 'EH46', 'EH47', 'EH48', 'EH49', 'EH51', 'EH52', 'EH53', 'EH54', 'EH55'],
    glasgow: ['G1', 'G2', 'G3', 'G4', 'G5', 'G11', 'G12', 'G13', 'G14', 'G15', 'G20', 'G21', 'G22', 'G23', 'G31', 'G32', 'G33', 'G34', 'G40', 'G41', 'G42', 'G43', 'G44', 'G45', 'G46', 'G51', 'G52', 'G53', 'G60', 'G61', 'G62', 'G63', 'G64', 'G65', 'G66', 'G67', 'G68', 'G69', 'G71', 'G72', 'G73', 'G74', 'G76', 'G77', 'G78', 'G81', 'G82', 'G83', 'G84'],
    cambridge: ['CB1', 'CB2', 'CB3', 'CB4', 'CB5', 'CB6', 'CB7', 'CB8', 'CB9', 'CB10', 'CB11', 'CB21', 'CB22', 'CB23', 'CB24', 'CB25'],
    oxford: ['OX1', 'OX2', 'OX3', 'OX4', 'OX5', 'OX7', 'OX9', 'OX10', 'OX11', 'OX12', 'OX13', 'OX14', 'OX15', 'OX16', 'OX17', 'OX18', 'OX20', 'OX25', 'OX26', 'OX27', 'OX28', 'OX29', 'OX33', 'OX39', 'OX44', 'OX49'],
    chester: ['CH1', 'CH2', 'CH3', 'CH4', 'CH5', 'CH6', 'CH7', 'CH8'],
    newcastle: ['NE1', 'NE2', 'NE3', 'NE4', 'NE5', 'NE6', 'NE7', 'NE8', 'NE9', 'NE10', 'NE11', 'NE12', 'NE13', 'NE15', 'NE16', 'NE17', 'NE18', 'NE19', 'NE20', 'NE21', 'NE22', 'NE23', 'NE24', 'NE25', 'NE26', 'NE27', 'NE28', 'NE29', 'NE30', 'NE31', 'NE32', 'NE33', 'NE34', 'NE35', 'NE36', 'NE37', 'NE38', 'NE39', 'NE40', 'NE41', 'NE42', 'NE43', 'NE44', 'NE45', 'NE46', 'NE47', 'NE48', 'NE49', 'NE61', 'NE62', 'NE63', 'NE64', 'NE65', 'NE66', 'NE67', 'NE68', 'NE69', 'NE70', 'NE71'],
    sheffield: ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8', 'S9', 'S10', 'S11', 'S12', 'S13', 'S14', 'S17', 'S20', 'S21', 'S25', 'S26', 'S30', 'S35', 'S36', 'S40', 'S41', 'S60', 'S61', 'S62', 'S63', 'S64', 'S65', 'S66', 'S70', 'S71', 'S72', 'S73', 'S74', 'S75', 'S80', 'S81'],
    nottingham: ['NG1', 'NG2', 'NG3', 'NG4', 'NG5', 'NG6', 'NG7', 'NG8', 'NG9', 'NG10', 'NG11', 'NG12', 'NG13', 'NG14', 'NG15', 'NG16', 'NG17', 'NG18', 'NG19', 'NG20', 'NG21', 'NG22', 'NG23', 'NG24', 'NG25', 'NG31', 'NG32', 'NG33', 'NG34'],
    cardiff: ['CF3', 'CF5', 'CF10', 'CF11', 'CF14', 'CF15', 'CF23', 'CF24', 'CF30', 'CF31', 'CF33', 'CF35', 'CF37', 'CF38', 'CF39', 'CF40', 'CF41', 'CF42', 'CF43', 'CF44', 'CF45', 'CF46', 'CF47', 'CF48', 'CF61', 'CF62', 'CF63', 'CF64', 'CF71', 'CF72', 'CF81', 'CF82', 'CF83'],
    brighton: ['BN1', 'BN2', 'BN3', 'BN41', 'BN42', 'BN43', 'BN45'],
    belfast: [
      'BT1', 'BT2', 'BT3', 'BT4', 'BT5', 'BT6', 'BT7', 'BT8', 'BT9', 'BT10', 'BT11', 'BT12',
      'BT13', 'BT14', 'BT15', 'BT16', 'BT17', 'BT27', 'BT28', 'BT29', 'BT36', 'BT37', 'BT38',
      'BT39',
    ],
    reading: ['RG1', 'RG2', 'RG4', 'RG5', 'RG6', 'RG7', 'RG8', 'RG10', 'RG30', 'RG31', 'RG40', 'RG41', 'RG42'],
    leicester: ['LE1', 'LE2', 'LE3', 'LE4', 'LE5', 'LE7', 'LE8', 'LE9', 'LE19'],
    bournemouth: ['BH1', 'BH2', 'BH3', 'BH4', 'BH5', 'BH6', 'BH7', 'BH8', 'BH9', 'BH10', 'BH11', 'BH12', 'BH23'],
    cheshire: [
      'CH1', 'CH2', 'CH3', 'CH4', 'CH5', 'CH6', 'CH7', 'CH8',
      'CW1', 'CW2', 'CW3', 'CW4', 'CW5', 'CW6', 'CW7', 'CW8', 'CW9', 'CW10', 'CW11', 'CW12',
      'WA1', 'WA2', 'WA3', 'WA4', 'WA5', 'WA6', 'WA7', 'WA8', 'WA9', 'WA10', 'WA11', 'WA12',
      'WA13', 'WA14', 'WA15', 'WA16',
      'SK9', 'SK10', 'SK11', 'SK12',
    ],
    surrey: [
      'GU1', 'GU2', 'GU3', 'GU4', 'GU5', 'GU6', 'GU7', 'GU8', 'GU9', 'GU10',
      'GU11', 'GU12', 'GU13', 'GU14', 'GU15', 'GU16', 'GU17', 'GU18', 'GU19', 'GU20',
      'GU21', 'GU22', 'GU23', 'GU24', 'GU25', 'GU26', 'GU27',
      'RH1', 'RH2', 'RH3', 'RH4', 'RH5', 'RH6', 'RH7', 'RH8', 'RH9', 'RH10',
      'RH11', 'RH12', 'RH13', 'RH14', 'RH15', 'RH16', 'RH17', 'RH18', 'RH19', 'RH20',
      'KT10', 'KT11', 'KT12', 'KT13', 'KT14', 'KT15', 'KT16', 'KT17', 'KT18', 'KT19',
      'KT20', 'KT21', 'KT22', 'KT23', 'KT24',
      'SM7',
    ],
    kent: [
      'CT1', 'CT2', 'CT3', 'CT4', 'CT5', 'CT6', 'CT7', 'CT8', 'CT9', 'CT10',
      'CT11', 'CT12', 'CT13', 'CT14', 'CT15', 'CT16', 'CT17', 'CT18', 'CT19', 'CT20', 'CT21',
      'ME1', 'ME2', 'ME3', 'ME4', 'ME5', 'ME6', 'ME7', 'ME8', 'ME9', 'ME10',
      'ME11', 'ME12', 'ME13', 'ME14', 'ME15', 'ME16', 'ME17', 'ME18', 'ME19', 'ME20',
      'TN1', 'TN2', 'TN3', 'TN4', 'TN5', 'TN6', 'TN7', 'TN8', 'TN9', 'TN10',
      'TN11', 'TN12', 'TN13', 'TN14', 'TN15', 'TN16', 'TN17', 'TN18', 'TN19', 'TN20',
      'TN21', 'TN22', 'TN23', 'TN24', 'TN25', 'TN26', 'TN27', 'TN28', 'TN29', 'TN30',
      'TN31', 'TN32', 'TN33', 'TN34', 'TN35', 'TN36', 'TN37', 'TN38', 'TN39', 'TN40',
      'DA2', 'DA3', 'DA4', 'DA9', 'DA10', 'DA11', 'DA12', 'DA13',
    ],
    hampshire: [
      'SO14', 'SO15', 'SO16', 'SO17', 'SO18', 'SO19', 'SO20', 'SO21', 'SO22', 'SO23',
      'SO24', 'SO30', 'SO31', 'SO32', 'SO40', 'SO41', 'SO42', 'SO43', 'SO45', 'SO50',
      'SO51', 'SO52', 'SO53',
      'PO1', 'PO2', 'PO3', 'PO4', 'PO5', 'PO6', 'PO7', 'PO8', 'PO9', 'PO10',
      'PO11', 'PO12', 'PO13', 'PO14', 'PO15', 'PO16', 'PO17',
      'GU30', 'GU31', 'GU32', 'GU33', 'GU34', 'GU35',
    ],
    lancashire: [
      'PR1', 'PR2', 'PR3', 'PR4', 'PR5', 'PR6', 'PR7', 'PR8', 'PR9', 'PR11',
      'PR25', 'PR26',
      'BB1', 'BB2', 'BB3', 'BB4', 'BB5', 'BB6', 'BB7', 'BB8', 'BB9', 'BB10',
      'BB11', 'BB12',
      'FY1', 'FY2', 'FY3', 'FY4', 'FY5', 'FY6', 'FY7', 'FY8',
      'LA1', 'LA2', 'LA3', 'LA4', 'LA5', 'LA6',
      'WN1', 'WN2', 'WN3', 'WN4', 'WN5', 'WN6', 'WN7', 'WN8',
    ],
    essex: [
      'CM0', 'CM1', 'CM2', 'CM3', 'CM4', 'CM5', 'CM6', 'CM7', 'CM8', 'CM9',
      'CM11', 'CM12', 'CM13', 'CM14', 'CM15', 'CM16', 'CM17', 'CM18', 'CM19', 'CM20',
      'CM21', 'CM22', 'CM23', 'CM24',
      'CO1', 'CO2', 'CO3', 'CO4', 'CO5', 'CO6', 'CO7', 'CO8', 'CO9', 'CO10',
      'CO11', 'CO12', 'CO13', 'CO14', 'CO15', 'CO16',
      'SS0', 'SS1', 'SS2', 'SS3', 'SS4', 'SS5', 'SS6', 'SS7', 'SS8', 'SS9',
      'SS11', 'SS12', 'SS13', 'SS14', 'SS15', 'SS16', 'SS17',
    ],
    hertfordshire: [
      'AL1', 'AL2', 'AL3', 'AL4', 'AL5', 'AL6', 'AL7', 'AL8', 'AL9', 'AL10',
      'SG1', 'SG2', 'SG3', 'SG4', 'SG5', 'SG6', 'SG7', 'SG8', 'SG9', 'SG10',
      'SG11', 'SG12', 'SG13', 'SG14', 'SG15', 'SG16', 'SG17', 'SG18', 'SG19',
      'WD3', 'WD4', 'WD5', 'WD6', 'WD7', 'WD17', 'WD18', 'WD19', 'WD23', 'WD24', 'WD25',
      'EN6', 'EN7', 'EN8', 'EN9', 'EN10', 'EN11',
      'HP1', 'HP2', 'HP3', 'HP4', 'HP5',
    ],
    berkshire: [
      'RG1', 'RG2', 'RG4', 'RG5', 'RG6', 'RG7', 'RG8', 'RG9', 'RG10',
      'RG12', 'RG14', 'RG17', 'RG18', 'RG19', 'RG20', 'RG21', 'RG22', 'RG23', 'RG24',
      'RG25', 'RG26', 'RG27', 'RG28', 'RG29', 'RG30', 'RG31', 'RG40', 'RG41', 'RG42',
      'SL0', 'SL1', 'SL2', 'SL3', 'SL4', 'SL5', 'SL6', 'SL7', 'SL8', 'SL9',
    ],
    oxfordshire: [
      'OX1', 'OX2', 'OX3', 'OX4', 'OX5', 'OX7', 'OX9', 'OX10', 'OX11', 'OX12', 'OX13',
      'OX14', 'OX15', 'OX16', 'OX17', 'OX18', 'OX20', 'OX25', 'OX26', 'OX27', 'OX28',
      'OX29', 'OX33', 'OX39', 'OX44', 'OX49',
    ],
    buckinghamshire: [
      'HP6', 'HP7', 'HP8', 'HP9', 'HP10', 'HP11', 'HP12', 'HP13', 'HP14', 'HP15',
      'HP16', 'HP17', 'HP18', 'HP19', 'HP20', 'HP21', 'HP22', 'HP23', 'HP27',
      'MK1', 'MK2', 'MK3', 'MK4', 'MK5', 'MK6', 'MK7', 'MK8', 'MK9', 'MK10',
      'MK11', 'MK12', 'MK13', 'MK14', 'MK15', 'MK16', 'MK17', 'MK18', 'MK19',
    ],
    cambridgeshire: [
      'CB1', 'CB2', 'CB3', 'CB4', 'CB5', 'CB6', 'CB7', 'CB8', 'CB9', 'CB10', 'CB11',
      'CB21', 'CB22', 'CB23', 'CB24', 'CB25',
      'PE1', 'PE2', 'PE3', 'PE4', 'PE5', 'PE6', 'PE7', 'PE8',
      'PE13', 'PE14', 'PE15', 'PE16', 'PE19', 'PE26', 'PE27', 'PE28', 'PE29',
    ],
    sussex: [
      'BN1', 'BN2', 'BN3', 'BN5', 'BN6', 'BN7', 'BN8', 'BN9', 'BN10', 'BN11',
      'BN12', 'BN13', 'BN14', 'BN15', 'BN16', 'BN17', 'BN18', 'BN20', 'BN21',
      'BN22', 'BN23', 'BN24', 'BN25', 'BN26', 'BN27', 'BN41', 'BN42', 'BN43',
      'BN44', 'BN45',
      'PO18', 'PO19', 'PO20', 'PO21', 'PO22',
    ],
  };

  var COUNTY_SLUGS = {
    cheshire: true,
    surrey: true,
    kent: true,
    hampshire: true,
    lancashire: true,
    essex: true,
    hertfordshire: true,
    berkshire: true,
    oxfordshire: true,
    buckinghamshire: true,
    cambridgeshire: true,
    sussex: true,
  };

  var sectorSetCache = {};

  function sectorsForRegion(regionKey) {
    return REGION_SECTORS[regionKey] || [];
  }

  function findRegionForSector(sec) {
    var keys = Object.keys(REGION_SECTORS).sort(function (a, b) {
      var aCounty = COUNTY_SLUGS[a] ? 1 : 0;
      var bCounty = COUNTY_SLUGS[b] ? 1 : 0;
      if (aCounty !== bCounty) return aCounty - bCounty;
      if (a === 'london') return 1;
      if (b === 'london') return -1;
      return 0;
    });
    for (var i = 0; i < keys.length; i++) {
      var list = REGION_SECTORS[keys[i]];
      for (var j = 0; j < list.length; j++) {
        if (list[j] === sec) return keys[i];
      }
    }
    return null;
  }

  function allowedSectors(userOutcode) {
    var oc = parseOutcode(userOutcode);
    if (!oc) return null;
    var sec = sectorOf(oc);
    if (sectorSetCache[sec]) return sectorSetCache[sec];

    var allowed = {};
    allowed[sec] = true;
    allowed[oc] = true;

    var region = findRegionForSector(sec);
    if (region) {
      sectorsForRegion(region).forEach(function (s) {
        allowed[s] = true;
      });
    }

    sectorSetCache[sec] = allowed;
    return allowed;
  }

  window.hubParseOutcode = parseOutcode;

  var CITY_ALIASES = {
    manchester: 'manchester',
    mcr: 'manchester',
    london: 'london',
    'central london': 'central-london',
    'north london': 'north-london',
    'south london': 'south-london',
    'east london': 'east-london',
    'west london': 'west-london',
    birmingham: 'birmingham',
    bham: 'birmingham',
    leeds: 'leeds',
    liverpool: 'liverpool',
    bristol: 'bristol',
    edinburgh: 'edinburgh',
    glasgow: 'glasgow',
    cambridge: 'cambridge',
    oxford: 'oxford',
    chester: 'chester',
    newcastle: 'newcastle',
    sheffield: 'sheffield',
    nottingham: 'nottingham',
    cardiff: 'cardiff',
    brighton: 'brighton',
    belfast: 'belfast',
    reading: 'reading',
    leicester: 'leicester',
    bournemouth: 'bournemouth',
    cheshire: 'cheshire',
    surrey: 'surrey',
    kent: 'kent',
    hampshire: 'hampshire',
    hants: 'hampshire',
    lancashire: 'lancashire',
    lancs: 'lancashire',
    essex: 'essex',
    hertfordshire: 'hertfordshire',
    herts: 'hertfordshire',
    berkshire: 'berkshire',
    berks: 'berkshire',
    oxfordshire: 'oxfordshire',
    oxon: 'oxfordshire',
    buckinghamshire: 'buckinghamshire',
    bucks: 'buckinghamshire',
    cambridgeshire: 'cambridgeshire',
    cambs: 'cambridgeshire',
    sussex: 'sussex',
    'east sussex': 'sussex',
    'west sussex': 'sussex',
  };

  function normalizeLocationText(raw) {
    if (!raw) return '';
    return String(raw).trim().toLowerCase().replace(/\s+/g, ' ');
  }

  var UK_FULL_POSTCODE_RE = /\b([A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2})\b/i;

  function parseFullUkPostcode(raw) {
    var text = String(raw || '').trim();
    if (!text) return '';
    if (/\s/.test(text)) {
      var spaced = text.match(/\b([A-Z]{1,2}\d{1,2}[A-Z]?)\s+\d[A-Z]{2}\b/i);
      if (spaced) {
        var inward = text.match(/\d[A-Z]{2}\b/i);
        return (spaced[1] + ' ' + (inward ? inward[0] : '')).trim().toUpperCase();
      }
      return '';
    }
    var compact = text.replace(/\s+/g, '').toUpperCase();
    var parts = compact.match(/^(.+?)(\d[A-Z]{2})$/);
    if (parts) {
      var oc = parseOutcode(compact);
      if (oc) return oc + ' ' + parts[2];
    }
    return '';
  }

  function parseCityFromLocationLabel(location, postcodeHint) {
    var parts = String(location || '')
      .split(',')
      .map(function (s) {
        return s.trim();
      })
      .filter(Boolean);
    if (!parts.length) return '';

    var pcNorm = String(postcodeHint || parseFullUkPostcode(location) || '')
      .replace(/\s+/g, '')
      .toUpperCase();

    for (var i = parts.length - 1; i >= 0; i--) {
      var part = parts[i];
      var partNorm = part.replace(/\s+/g, '').toUpperCase();
      if (pcNorm && partNorm === pcNorm) continue;
      if (parseOutcode(part)) continue;
      if (part.length >= 2 && part.length <= 64) return part;
    }
    return '';
  }

  window.hubParseFullUkPostcode = parseFullUkPostcode;
  window.hubParseCityFromLocationLabel = parseCityFromLocationLabel;

  function cityRegionFromInput(raw) {
    var norm = normalizeLocationText(raw);
    if (!norm) return null;
    if (CITY_ALIASES[norm]) return CITY_ALIASES[norm];

    var aliasKeys = Object.keys(CITY_ALIASES).sort(function (a, b) {
      return b.length - a.length;
    });
    for (var a = 0; a < aliasKeys.length; a++) {
      var alias = aliasKeys[a];
      if (norm === alias || norm.indexOf(alias) !== -1) return CITY_ALIASES[alias];
    }

    if (REGION_SECTORS[norm]) return norm;
    var keys = Object.keys(REGION_SECTORS).sort(function (a, b) {
      return b.length - a.length;
    });
    for (var i = 0; i < keys.length; i++) {
      if (norm === keys[i] || norm.indexOf(keys[i]) !== -1) return keys[i];
    }
    return null;
  }

  function eventLocationHaystack(ev) {
    return [
      ev.city,
      ev.locationShort,
      ev.location,
      ev.venue,
      ev.postcode,
      ev.address,
      ev.venueAddress,
      ev.outcode,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
  }

  function matchesCityRegion(region, ev) {
    var hay = eventLocationHaystack(ev);
    if (hay.indexOf(region) !== -1) return true;
    var allowed = {};
    sectorsForRegion(region).forEach(function (s) {
      allowed[s] = true;
    });
    var eventOc = window.hubEventOutcode(ev);
    if (!eventOc) return false;
    var eventSec = sectorOf(eventOc);
    return !!(allowed[eventOc] || allowed[eventSec]);
  }

  window.hubEventOutcode = function (ev) {
    if (ev.outcode) return ev.outcode;
    var pc = ev.postcode || '';
    var fromLoc = [ev.location, ev.venue, ev.address, ev.city].join(' ');
    return parseOutcode(pc) || parseOutcode(fromLoc);
  };

  window.hubLocationFilterState = null;

  function buildAllowedFromOutcodes(postcodes) {
    var allowed = {};
    (postcodes || []).forEach(function (row) {
      var pc = typeof row === 'string' ? row : row && row.postcode;
      var out = parseOutcode(pc);
      if (!out) return;
      allowed[out] = true;
      var sec = sectorOf(out);
      allowed[sec] = true;
      var region = findRegionForSector(sec);
      if (region) {
        sectorsForRegion(region).forEach(function (s) {
          allowed[s] = true;
        });
      }
    });
    return allowed;
  }

  window.hubPrefersGeoRadiusForLocation = function (input) {
    return !!parseFullUkPostcode(String(input || '').trim());
  };

  window.hubResolveLocationFilter = function (input) {
    var raw = String(input || '').trim();
    if (!raw) {
      window.hubLocationFilterState = null;
      return Promise.resolve();
    }

    if (parseFullUkPostcode(raw)) {
      window.hubLocationFilterState = { query: raw, mode: 'geo' };
      return Promise.resolve();
    }

    var oc = parseOutcode(raw);
    if (oc) {
      window.hubLocationFilterState = { query: raw, mode: 'outcode' };
      return Promise.resolve();
    }

    var region = cityRegionFromInput(raw);
    if (region) {
      var regionAllowed = {};
      sectorsForRegion(region).forEach(function (s) {
        regionAllowed[s] = true;
      });
      window.hubLocationFilterState = {
        query: raw,
        mode: 'allowed',
        allowed: regionAllowed,
      };
      return Promise.resolve();
    }

    var norm = normalizeLocationText(raw);

    return fetch(
      'https://api.postcodes.io/postcodes?q=' + encodeURIComponent(raw) + '&limit=10'
    )
      .then(function (res) {
        return res.json();
      })
      .then(function (data) {
        if (data.status === 200 && data.result && data.result.length) {
          window.hubLocationFilterState = {
            query: raw,
            mode: 'allowed',
            allowed: buildAllowedFromOutcodes(data.result),
          };
          return;
        }
        window.hubLocationFilterState = { query: raw, mode: 'text', text: norm };
      })
      .catch(function () {
        window.hubLocationFilterState = { query: raw, mode: 'text', text: norm };
      });
  };

  /** True if event matches user postcode, outcode, or city filter. */
  window.hubMatchOutcode = function (userInput, ev) {
    var raw = String(userInput || '').trim();
    if (!raw) return true;

    var state = window.hubLocationFilterState;
    if (state && state.query === raw && state.mode === 'allowed' && state.allowed) {
      var allowedOc = window.hubEventOutcode(ev);
      if (allowedOc) {
        var allowedSec = sectorOf(allowedOc);
        if (state.allowed[allowedOc] || state.allowed[allowedSec]) return true;
        return false;
      }
      var placeText = normalizeLocationText(raw);
      if (placeText.length >= 3) {
        return eventLocationHaystack(ev).indexOf(placeText) !== -1;
      }
      return false;
    }
    if (state && state.query === raw && state.mode === 'text' && state.text) {
      return eventLocationHaystack(ev).indexOf(state.text) !== -1;
    }

    var parsedOc = parseOutcode(raw);
    if (parsedOc) {
      var allowed = allowedSectors(raw);
      if (!allowed) return true;
      var oc = window.hubEventOutcode(ev);
      if (!oc) return false;
      var sec = sectorOf(oc);
      return !!(allowed[oc] || allowed[sec]);
    }

    var cityRegion = cityRegionFromInput(raw);
    if (cityRegion) return matchesCityRegion(cityRegion, ev);

    var norm = normalizeLocationText(raw);
    if (norm.length >= 3) {
      return eventLocationHaystack(ev).indexOf(norm) !== -1;
    }

    return true;
  };

  window.hubAllowedOutcodesForQuery = function (input) {
    var raw = String(input || '').trim();
    if (!raw) return [];
    if (parseFullUkPostcode(raw)) return [];
    var state = window.hubLocationFilterState;
    if (state && state.query === raw && state.allowed) {
      return Object.keys(state.allowed);
    }
    var allowed = allowedSectors(raw);
    if (allowed) return Object.keys(allowed);
    var region = cityRegionFromInput(raw);
    if (region) return sectorsForRegion(region);
    return [];
  };

  function toNetworkingRegionSlug(regionKey) {
    if (!regionKey) return '';
    if (regionKey === 'london') return 'central-london';
    if (typeof window.HUB_getNetworkingRegion === 'function' && window.HUB_getNetworkingRegion(regionKey)) {
      return regionKey;
    }
    if (typeof window.HUB_resolveNetworkingRegionSlug === 'function') {
      var fromName = window.HUB_resolveNetworkingRegionSlug(regionKey);
      if (fromName) return fromName;
    }
    return regionKey;
  }

  window.hubNetworkingRegionSlugFromInput = function (raw) {
    var text = String(raw || '').trim();
    if (!text) return '';

    if (typeof window.HUB_resolveNetworkingRegionSlug === 'function') {
      var direct = window.HUB_resolveNetworkingRegionSlug(text);
      if (direct) return direct;
    }

    var fullPc = parseFullUkPostcode(text);
    if (fullPc) {
      var fromFull = parseOutcode(fullPc);
      if (fromFull) {
        return toNetworkingRegionSlug(findRegionForSector(sectorOf(fromFull)));
      }
    }

    var oc = parseOutcode(text);
    if (oc) {
      return toNetworkingRegionSlug(findRegionForSector(sectorOf(oc)));
    }

    return toNetworkingRegionSlug(cityRegionFromInput(text));
  };

  window.hubOutcodeLabel = function (userInput) {
    var raw = String(userInput || '').trim();
    if (!raw) return '';
    var oc = parseOutcode(raw);
    if (oc) {
      var region = findRegionForSector(sectorOf(oc));
      return region ? oc + ' (' + region.replace(/^\w/, function (c) { return c.toUpperCase(); }) + ' area)' : oc;
    }
    var cityRegion = cityRegionFromInput(raw);
    if (cityRegion) {
      return cityRegion.replace(/^\w/, function (c) { return c.toUpperCase(); });
    }
    return raw;
  };
})();
