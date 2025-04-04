import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, InteractionManager } from 'react-native';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import { withNavigation } from '@react-navigation/compat';
import { showAlert } from '../../../actions/alert';
import Transactions from '../../UI/Transactions';
import {
  TX_UNAPPROVED,
  TX_SUBMITTED,
  TX_SIGNED,
  TX_PENDING,
  TX_CONFIRMED,
} from '../../../constants/transaction';
import {
  sortTransactions,
  filterByAddressAndNetwork,
} from '../../../util/activity';
import { safeToChecksumAddress } from '../../../util/address';
import { addAccountTimeFlagFilter } from '../../../util/transactions';
import { toLowerCaseEquals } from '../../../util/general';
import {
  selectChainId,
  selectProviderType,
} from '../../../selectors/networkController';
import {
  selectConversionRate,
  selectCurrentCurrency,
} from '../../../selectors/currencyRateController';
import { selectTokens } from '../../../selectors/tokensController';
import { selectSelectedInternalAccount } from '../../../selectors/accountsController';
import { store } from '../../../store';
import { NETWORK_ID_LOADING } from '../../../core/redux/slices/inpageProvider';
import { selectSortedTransactions } from '../../../selectors/transactionController';
import { toChecksumHexAddress } from '@metamask/controller-utils';

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
});

const TransactionsView = ({
  navigation,
  conversionRate,
  selectedInternalAccount,
  networkType,
  currentCurrency,
  transactions,
  chainId,
  tokens,
}) => {
  const [allTransactions, setAllTransactions] = useState([]);
  const [submittedTxs, setSubmittedTxs] = useState([]);
  const [confirmedTxs, setConfirmedTxs] = useState([]);
  const [loading, setLoading] = useState();

  const selectedAddress = toChecksumHexAddress(
    selectedInternalAccount?.address,
  );

  const filterTransactions = useCallback(
    (networkId) => {
      if (networkId === NETWORK_ID_LOADING) return;

      let accountAddedTimeInsertPointFound = false;
      const addedAccountTime = selectedInternalAccount?.metadata.importTime;

      const submittedTxs = [];
      const confirmedTxs = [];
      const submittedNonces = [];

      const allTransactionsSorted = sortTransactions(transactions).filter(
        (tx, index, self) =>
          self.findIndex((_tx) => _tx.id === tx.id) === index,
      );

      const allTransactions = allTransactionsSorted.filter((tx) => {
        const filter = filterByAddressAndNetwork(
          tx,
          tokens,
          selectedAddress,
          networkId,
          chainId,
        );

        if (!filter) return false;

        tx.insertImportTime = addAccountTimeFlagFilter(
          tx,
          addedAccountTime,
          accountAddedTimeInsertPointFound,
        );
        if (tx.insertImportTime) accountAddedTimeInsertPointFound = true;

        switch (tx.status) {
          case TX_SUBMITTED:
          case TX_SIGNED:
          case TX_UNAPPROVED:
          case TX_PENDING:
            submittedTxs.push(tx);
            return false;
          case TX_CONFIRMED:
            confirmedTxs.push(tx);
            break;
        }

        return filter;
      });
      const submittedTxsFiltered = submittedTxs.filter(({ txParams }) => {
        const { from, nonce } = txParams;
        if (!toLowerCaseEquals(from, selectedAddress)) {
          return false;
        }
        const alreadySubmitted = submittedNonces.includes(nonce);
        const alreadyConfirmed = confirmedTxs.find(
          (tx) =>
            toLowerCaseEquals(
              safeToChecksumAddress(tx.txParams.from),
              selectedAddress,
            ) && tx.txParams.nonce === nonce,
        );
        if (alreadyConfirmed) {
          return false;
        }
        submittedNonces.push(nonce);
        return !alreadySubmitted;
      });

      //if the account added insertpoint is not found add it to the last transaction
      if (
        !accountAddedTimeInsertPointFound &&
        allTransactions &&
        allTransactions.length
      ) {
        allTransactions[allTransactions.length - 1].insertImportTime = true;
      }

      setAllTransactions(allTransactions);
      setSubmittedTxs(submittedTxsFiltered);
      setConfirmedTxs(confirmedTxs);
      setLoading(false);
    },
    [transactions, selectedInternalAccount, selectedAddress, tokens, chainId],
  );

  useEffect(() => {
    setLoading(true);
    /*
    Since this screen is always mounted and computations happen on this screen everytime the user changes network
    using the InteractionManager will help by giving enough time for any animations/screen transactions before it starts
    computing the transactions which will make the app feel more responsive. Also this takes usually less than 1 seconds
    so the effect will not be noticeable if the user is in this screen.
    */
    InteractionManager.runAfterInteractions(() => {
      const state = store.getState();
      const networkId =
        state?.engine?.backgroundState?.NetworkController
          ?.selectedNetworkClientId;

      if (networkId) {
        filterTransactions(networkId);
      }
    });
  }, [filterTransactions]);

  return (
    <View style={styles.wrapper}>
      <Transactions
        navigation={navigation}
        transactions={allTransactions}
        submittedTransactions={submittedTxs}
        confirmedTransactions={confirmedTxs}
        conversionRate={conversionRate}
        currentCurrency={currentCurrency}
        selectedAddress={selectedAddress}
        networkType={networkType}
        loading={loading}
      />
    </View>
  );
};

TransactionsView.propTypes = {
  /**
   * ETH to current currency conversion rate
   */
  conversionRate: PropTypes.number,
  /**
   * Currency code of the currently-active currency
   */
  currentCurrency: PropTypes.string,
  /**
  /* InternalAccount object required to get account name, address and import time
  */
  selectedInternalAccount: PropTypes.object,
  /**
  /* navigation object required to push new views
  */
  navigation: PropTypes.object,
  /**
   * An array that represents the user transactions
   */
  transactions: PropTypes.array,
  /**
   * A string represeting the network name
   */
  networkType: PropTypes.string,
  /**
   * Array of ERC20 assets
   */
  tokens: PropTypes.array,
  /**
   * Current chainId
   */
  chainId: PropTypes.string,
};

const mapStateToProps = (state) => {
  const chainId = selectChainId(state);

  return {
    conversionRate: selectConversionRate(state),
    currentCurrency: selectCurrentCurrency(state),
    tokens: selectTokens(state),
    selectedInternalAccount: selectSelectedInternalAccount(state),
    transactions: selectSortedTransactions(state),
    networkType: selectProviderType(state),
    chainId,
  };
};

const mapDispatchToProps = (dispatch) => ({
  showAlert: (config) => dispatch(showAlert(config)),
});

export default connect(
  mapStateToProps,
  mapDispatchToProps,
)(withNavigation(TransactionsView));
