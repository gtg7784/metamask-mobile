import { BigNumber } from 'bignumber.js';
import { TransactionType } from '@metamask/transaction-controller';
import useHandleTx from './useHandleTx';
import { QuoteResponse } from '../../../components/UI/Bridge/types';
import { addHexPrefix } from '../../number';
import { Hex } from '@metamask/utils';
import { FeeType } from '@metamask/bridge-controller';

export default function useHandleBridgeTx() {
  const { handleTx } = useHandleTx();

  const handleBridgeTx = async ({
    quoteResponse,
    approvalTxId,
  }: {
    quoteResponse: QuoteResponse;
    approvalTxId: string | undefined;
  }) => {
    const sentAmount = new BigNumber(quoteResponse.quote.srcTokenAmount).plus(
      quoteResponse.quote.feeData[FeeType.METABRIDGE].amount,
    );
    const sentAmountDec = new BigNumber(sentAmount, 10)
      .shiftedBy(quoteResponse.quote.srcAsset.decimals)
      .toString();

    const txMeta = await handleTx({
      txType: TransactionType.bridge,
      txParams: quoteResponse.trade,
      fieldsToAddToTxMeta: {
        destinationChainId: addHexPrefix(String(quoteResponse.quote.destChainId)).toLowerCase() as Hex,
        // estimatedBaseFee: decEstimatedBaseFee,

        sourceTokenAmount: quoteResponse.quote.srcTokenAmount,
        sourceTokenSymbol: quoteResponse.quote.srcAsset.symbol,
        sourceTokenDecimals: quoteResponse.quote.srcAsset.decimals,
        sourceTokenAddress: quoteResponse.quote.srcAsset.address,

        destinationTokenAmount: quoteResponse.quote.destTokenAmount,
        destinationTokenSymbol: quoteResponse.quote.destAsset.symbol,
        destinationTokenDecimals: quoteResponse.quote.destAsset.decimals,
        destinationTokenAddress: quoteResponse.quote.destAsset.address,

        approvalTxId,
        // this is the decimal (non atomic) amount (not USD value) of source token to swap
        swapTokenValue: sentAmountDec,
      },
    });

    return txMeta;
  };

  return { handleBridgeTx };
}
